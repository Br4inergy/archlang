/**
 * The datum table (ADR 0028 §1): what one resolution group's rooms and grid axes expose as
 * lines, frozen after every room is placed and before any wall resolves.
 *
 * A group is the root plan or one `place`d instance (ADR 0016). Its table holds every room
 * the group can see — its own and its descendants', carried into its frame under their
 * relative ids (`west.main`) — because that is exactly the room list the group resolves
 * against. A rectangular room contributes its four edge lines and its centre, in the frame
 * the group is resolved in (`+y` down, so `top` is the smaller `y`). A `polygon` or `circle`
 * room, a room that could not be placed, and a room of no positive size contribute no
 * lines; the table records why, so a later reader can refuse with the right code rather
 * than report an unknown name.
 *
 * The table is built and frozen here and read by nothing in the language yet (room-edge
 * datums are card PS3.2 part B). Building it is new work, so it is charged to the step
 * meter before it allocates.
 */

import { chargeSteps } from "./expr.js";
import type { RAxis, RRoom } from "./ir.js";

/** A rectangular room's lines: edges and centre, in the group's own frame (mm). */
export interface RoomDatums {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly cx: number;
  readonly cy: number;
}

/** Why a room the group can see exposes no lines. */
export type DatumRefusal = "polygon" | "circle" | "unplaced" | "degenerate";

/** One positioning axis of the plan's `axes` block (root group only). */
export interface DatumAxis {
  readonly axis: "x" | "y";
  /** The axis's derived label (`1`, `2`, … for `x`; `A`, `B`, … for `y`). */
  readonly label: string;
  /** Its position, grid-snapped as the axis is drawn (mm). */
  readonly pos: number;
}

/** A group's frozen datum table. Every level of it is read-only and `Object.freeze`d. */
export interface DatumTable {
  /** Rectangular rooms by id, in the order the group sees them. */
  readonly rooms: ReadonlyMap<string, RoomDatums>;
  /** Rooms the group can see that expose no lines, by id, with the reason. */
  readonly refused: ReadonlyMap<string, DatumRefusal>;
  /** The plan's positioning axes, sorted and labelled as drawn; empty in an instance. */
  readonly axes: readonly DatumAxis[];
}

/** A `ReadonlyMap` whose mutators throw, so a frozen table cannot be edited through a cast. */
function frozenMap<K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> {
  const m = new Map<K, V>(entries);
  const refuse = (): never => {
    throw new TypeError("a datum table is frozen");
  };
  m.set = refuse;
  m.delete = refuse;
  m.clear = refuse;
  return Object.freeze(m);
}

/**
 * Build and freeze the datum table of one resolution group, from the rooms it can see (in
 * that order) once relational placement has run, and the plan's axes (root only).
 *
 * Steps: one per room and one per axis, charged in one call BEFORE anything is allocated.
 */
export function buildDatumTable(rooms: readonly RRoom[], axes: readonly RAxis[] | undefined): DatumTable {
  chargeSteps(rooms.length + (axes?.length ?? 0));
  const lines: [string, RoomDatums][] = [];
  const refused: [string, DatumRefusal][] = [];
  for (const r of rooms) {
    if (r.circle) refused.push([r.id, "circle"]);
    else if (r.poly) refused.push([r.id, "polygon"]);
    else if (r._unplaced) refused.push([r.id, "unplaced"]);
    else if (!(r.size.w > 0 && r.size.h > 0)) refused.push([r.id, "degenerate"]);
    else {
      const { x, y } = r.at;
      const { w, h } = r.size;
      lines.push([r.id, Object.freeze({ top: y, bottom: y + h, left: x, right: x + w, cx: x + w / 2, cy: y + h / 2 })]);
    }
  }
  return Object.freeze({
    rooms: frozenMap(lines),
    refused: frozenMap(refused),
    axes: Object.freeze((axes ?? []).map((a) => Object.freeze({ axis: a.axis, label: a.label, pos: a.pos }))),
  });
}
