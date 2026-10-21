/**
 * `walls from rooms exterior <t_ext> partition <t_int> [{ except <room> … }]` — derive the
 * whole wall set of a group from its rooms (ADR 0028 §3, plan decision D5).
 *
 * One statement per group (the root storey, or one `place`d component). It reads the rooms
 * the group itself declares, never a descendant's (ADR 0016), and derives the exterior ring
 * on the outline of their union (a second, counter-clockwise ring round a courtyard covered
 * exactly by `outdoor` surfaces; nothing round a hole covered by a `void`) and one partition
 * on every shared edge run of two rooms. The derivation itself is `src/room-tiling.ts`; this
 * module turns its runs into walls and its refusals into diagnostics naming the rooms.
 *
 * The statement draws nothing itself. Its derived walls join the group's wall list the moment
 * it resolves (`ElementDef.yieldsWalls`, which also moves the group's resolve order: rooms,
 * the hole covers, the authored walls, then this statement, then the openings), and from
 * there `ResolvedPlan.walls`: they are drawn, hosted on, measured and reported like any wall,
 * but they are never `elements`, have no author-facing id, and carry `_derived`.
 *
 * An authored wall lying exactly on a derived line wins over the shared span (coexistence);
 * the drop is reported in `describe().derived_walls[]`.
 */

import type { Point, WallsFromRoomsNode } from "../ast.js";
import type { ElementDef, ParseCtx, ResolveCtx, TransformCtx } from "../registry.js";
import type { DerivedWallRow, ROutdoor, RRoom, RVoid, RWall, RWallsFromRooms } from "../ir.js";
import { DEFAULT_MATERIAL } from "../hatches.js";
import { segmentsOfWall } from "../geometry.js";
import { deriveWallsFromRooms, type TileCover, type TileRoom, type TileWallSeg } from "../room-tiling.js";
import { wall } from "./wall.js";

/** The words that lead a clause of the statement's body. */
const BODY_CLAUSES = ["except", "open", "between"] as const;

export const wallsFromRooms: ElementDef = {
  kind: "walls",
  keyword: "walls",
  doc: "Derive every wall of this group from its rooms: the exterior ring on their outline, a partition on each shared edge.",
  params: [
    { name: "exterior", type: "number", doc: "Thickness of the derived exterior ring, in mm." },
    { name: "partition", type: "number", doc: "Thickness of every derived partition, in mm." },
    {
      name: "except",
      type: "room…",
      optional: true,
      doc: "Rooms left out of the derivation (a terrace, a polygon or circle room).",
    },
  ],

  parse(ctx: ParseCtx): WallsFromRoomsNode {
    const kw = ctx.eatKeyword("walls");
    ctx.eatKeyword("from");
    ctx.eatKeyword("rooms");
    ctx.eatKeyword("exterior");
    const exterior = ctx.parseExpr();
    ctx.eatKeyword("partition");
    const partition = ctx.parseExpr();
    const except: WallsFromRoomsNode["except"] = [];
    if (ctx.isType("lcurly")) {
      ctx.next();
      while (!ctx.isType("rcurly") && !ctx.isType("eof")) {
        if (ctx.isKeyword("except")) {
          const ex = ctx.next();
          if (!ctx.isType("ident") || (BODY_CLAUSES as readonly string[]).includes(ctx.peek().value)) {
            ctx.fail("`except` needs at least one room id", ex);
          }
          while (ctx.isType("ident") && !(BODY_CLAUSES as readonly string[]).includes(ctx.peek().value)) {
            const t = ctx.next();
            except.push({ id: t.value, span: { start: t.start, end: t.end } });
          }
          continue;
        }
        if (ctx.isKeyword("open")) {
          ctx.fail(
            "`open between <A> and <B>` is not available yet in `walls from rooms` (ADR 0028 §3): write the two rooms as one room, or write their walls by hand",
          );
        }
        if (ctx.isKeyword("between")) {
          ctx.fail(
            "`between <A> and <B> thickness <t>` is not available yet in `walls from rooms` (ADR 0028 §3): write that partition by hand, on the shared edge, and it replaces the derived one",
          );
        }
        const t = ctx.peek();
        ctx.fail(
          `Expected "except" in the \`walls from rooms\` body but found ${t.type === "eof" ? "end of input" : `"${t.value}"`}`,
        );
      }
      ctx.eat("rcurly");
    }
    return { kind: "walls", id: "", exterior, partition, except, line: kw.line };
  },

  idPrefix: () => "walls",

  resolve(node, ctx: ResolveCtx): RWallsFromRooms {
    const n = node as WallsFromRoomsNode;
    const thick = (e: WallsFromRoomsNode["exterior"], what: string): number => {
      const v = ctx.eval(e);
      const t = ctx.snap(v) || v;
      if (!(t > 0)) {
        ctx.diag({
          severity: "error",
          message: `\`walls from rooms\` needs a positive ${what} thickness`,
          code: "E_WALL_THICKNESS",
          span: n.span,
        });
      }
      return t;
    };
    const tExt = thick(n.exterior, "exterior");
    const tInt = thick(n.partition, "partition");
    const out: RWallsFromRooms = {
      kind: "walls",
      id: ctx.id,
      exterior: tExt,
      partition: tInt,
      except: n.except.map((x) => x.id),
      _derivedWalls: [],
      _derivedRows: [],
      span: n.span,
    };
    const own = ctx.group?.() ?? [];
    if (own.some((e) => e.kind === "walls")) {
      ctx.diag({
        severity: "error",
        message:
          "A group may hold one `walls from rooms` statement: the first one already derives every wall of these rooms, so this one derives nothing",
        code: "E_WALLS_FROM_ROOMS_DUP",
        span: n.span,
      });
      return out;
    }
    const rooms = own.filter((e): e is RRoom => e.kind === "room" && e._unplaced !== true);
    const roomIds = new Set(rooms.map((r) => r.id));
    for (const x of n.except) {
      if (roomIds.has(x.id)) continue;
      ctx.diag({
        severity: "error",
        message: `\`except ${x.id}\` names no room written beside it: \`walls from rooms\` derives from the rooms of the plan or component it is written in, so only those can be left out`,
        code: "E_WALL_BETWEEN_ROOM",
        span: x.span,
      });
    }
    if (!(tExt > 0) || !(tInt > 0)) return out;
    const excluded = new Set(n.except.map((x) => x.id));
    const set: TileRoom[] = rooms
      .filter((r) => !excluded.has(r.id))
      .map((r) =>
        r.circle
          ? { id: r.id, shape: "circle" }
          : r.poly
            ? { id: r.id, shape: "polygon" }
            : { id: r.id, rect: { x0: r.at.x, y0: r.at.y, x1: r.at.x + r.size.w, y1: r.at.y + r.size.h } },
      );
    const covers: TileCover[] = own.flatMap((e): TileCover[] => {
      if (e.kind === "void") return [coverOfVoid(e)];
      if (e.kind === "outdoor") return [coverOfOutdoor(e)];
      return [];
    });
    const authored: TileWallSeg[] = own.flatMap((e) =>
      e.kind === "wall"
        ? segmentsOfWall(e).flatMap((s) => (s.arc ? [] : [{ a: s.a, b: s.b, wallId: e.id }]))
        : [],
    );
    const res = deriveWallsFromRooms(set, covers, authored, tInt);
    if (!res.ok) {
      for (const r of res.refusals) ctx.diag({ severity: "error", ...refusalText(r), code: r.code, span: n.span });
      return out;
    }
    for (const spec of res.walls) {
      out._derivedRows.push({
        from: "rooms",
        name: spec.name,
        ...(spec.between ? { between: spec.between } : {}),
        ...(spec.dropped.length > 0 ? { dropped: spec.dropped } : {}),
      });
      for (const piece of spec.pieces) {
        out._derivedWalls.push({
          kind: "wall",
          id: piece.name,
          category: spec.role,
          thickness: spec.role === "exterior" ? tExt : tInt,
          material: DEFAULT_MATERIAL,
          hatchScale: 1,
          hatchAngle: 0,
          height: ctx.storeyHeight,
          points: piece.points,
          closed: piece.closed,
          openings: [],
          span: n.span,
          _idAuthored: false,
          _derived: {
            from: "rooms",
            ...(spec.ring ? { ring: spec.ring } : {}),
            ...(spec.between ? { between: spec.between } : {}),
          },
        });
      }
    }
    return out;
  },

  yieldsWalls: (resolved) => (resolved as RWallsFromRooms)._derivedWalls,
  dependsOn: ["void", "outdoor"],

  /** Every derived wall's drawn band: the page must contain what the walls draw. */
  bounds(resolved): Point[] {
    return (resolved as RWallsFromRooms)._derivedWalls.flatMap((w) => wall.bounds(w));
  },

  /** The two thicknesses and every derived wall's own measures. */
  measures(resolved): number[] {
    const s = resolved as RWallsFromRooms;
    return [s.exterior, s.partition, ...s._derivedWalls.flatMap((w) => wall.measures!(w))];
  },

  /** Each derived wall as a wall costs (`wall.drawCost`, 2); the statement draws nothing else. */
  drawCost: (resolved) => 2 * (resolved as RWallsFromRooms)._derivedWalls.length,

  /** Nothing: the derived walls are drawn with every other wall, from `ResolvedPlan.walls`. */
  render: () => [],

  /** The frame's action: each derived wall rides as a wall, its name namespaced. */
  transform(resolved, t: TransformCtx): RWallsFromRooms {
    const s = resolved as RWallsFromRooms;
    const f = t.frame as { prefix?: string; component?: string };
    return {
      ...s,
      id: t.id,
      _derivedWalls: s._derivedWalls.map((w) => {
        const moved = wall.transform!(w, { ...t, id: t.nsId(w.id) }) as RWall;
        if (f.prefix !== undefined) moved._instance = f.prefix;
        if (f.component !== undefined) moved._component = f.component;
        return moved;
      }),
      _derivedRows: s._derivedRows.map((r): DerivedWallRow => {
        const row: DerivedWallRow = { ...r, name: t.nsId(r.name) };
        if (r.between) row.between = [t.nsId(r.between[0]), t.nsId(r.between[1])];
        if (r.dropped) {
          row.dropped = r.dropped.map((d) => {
            const a = t.point({ x: d.x1, y: d.y1 });
            const b = t.point({ x: d.x2, y: d.y2 });
            return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, by: t.nsId(d.by) };
          });
        }
        return row;
      }),
    };
  },
};

function coverOfVoid(v: RVoid): TileCover {
  return { kind: "void", rect: { x0: v.at.x, y0: v.at.y, x1: v.at.x + v.size.w, y1: v.at.y + v.size.h } };
}

function coverOfOutdoor(o: ROutdoor): TileCover {
  if (o.poly) return { kind: "outdoor", poly: o.poly };
  return { kind: "outdoor", rect: { x0: o.at.x, y0: o.at.y, x1: o.at.x + o.size.w, y1: o.at.y + o.size.h } };
}

/** A refusal in words: what is refused, the rooms, and what to do. */
function refusalText(r: { code: string; rooms: string[]; why: string }): { message: string; hints: string[] } {
  switch (r.code) {
    case "E_ROOM_NOT_RECTANGLE":
      return {
        message: `\`walls from rooms\` derives walls from rectangular rooms only: ${r.why}`,
        hints: [
          `Leave the room out with \`except ${r.rooms.join(" ")}\` and draw its walls by hand, or split it into rectangles.`,
        ],
      };
    case "E_ROOMS_OVERLAP":
      return {
        message: `\`walls from rooms\` cannot derive walls between rooms that overlap: ${r.why}`,
        hints: ["Move or resize the rooms so they meet edge to edge; a shared edge becomes the partition."],
      };
    case "E_ROOMS_NOT_TILING":
      return {
        message: `\`walls from rooms\` needs the rooms to tile one connected floor: ${r.why}`,
        hints: [
          "Write the leftover floor (a corridor, a lobby) as a room of its own, so every part of the floor belongs to a room and the rooms meet edge to edge.",
        ],
      };
    default:
      return {
        message: `\`walls from rooms\` cannot fit a partition on a shared edge shorter than its thickness: ${r.why}`,
        hints: ["Line the rooms' edges up, or make the shared edge at least as long as the partition is thick."],
      };
  }
}
