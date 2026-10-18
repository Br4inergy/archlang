import { describe, expect, it } from "vitest";
import { connectorConnection, DEFAULT_TOL, pointInRoomBox, resolvePlan, roomBox } from "../src/analyze.js";
import { pointInRect } from "../src/geometry/rect.js";
import { describe as describePlan, lint } from "../src/index.js";
import type { RDoor, RRoom } from "../src/ir.js";

/**
 * A hosted connector's `between` is read off its host wall's two FACES — one wall
 * thickness off each face, the room whose floor holds the probe, from the shape — not off
 * which room edges its centre point touches. The centre-point answer handed an exterior
 * door centred on a T-junction (or within the 200 mm tolerance of a partition's end) to
 * the two rooms inside, so the plan had no entrance (`docs/plans/plan-soundness/repro/
 * door-on-tee.arch`, backlog C.4). `straddles` records every room a face's clear span
 * covers when that is more than one: the partition runs into the opening.
 */

const edgeOf = (src: string, id: string) => describePlan(src).access.edges.find((e) => e.doorId === id);
const codes = (src: string): Array<string | undefined> => lint(src).map((d) => d.code);

/** `door-on-tee.arch`, reduced: a door centred where partition `p` meets the shell. */
const TEE = `plan "tee" {
  units mm
  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,5000) (0,5000) close }
  wall id=p partition thickness 100 { (4000,0) (4000,5000) }
  room id=a at (0,0) size 4000x5000 label "A"
  room id=b at (4000,0) size 4000x5000 label "B"
  door id=front on shell at 4000 width 900
  door id=inner on p at 50% width 800
}`;

/** Backlog C.4: an exterior door 100 mm off a partition's end, inside the 200 mm tolerance. */
const CORNER = `plan "corner" {
  units mm
  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,3000) (0,3000) close }
  wall id=mid partition thickness 100 { (4000,0) (4000,3000) }
  room id=a at (0,0) size 4000x3000 label "Hall"
  room id=b at (4000,0) size 4000x3000 label "Living"
  door id=d at (4100,3000) width 900 wall shell
  door id=d2 at (4000,1500) width 800 wall mid
}`;

describe("between is read off the host wall's faces", () => {
  it("a door centred on an exterior T-junction is an entrance into one room, and straddles both", () => {
    const front = edgeOf(TEE, "front")!;
    // The inner face's centre probe sits on the a|b boundary; each room covers 400 mm of
    // the clear span, so the tie goes to room order.
    expect(front.between).toEqual(["exterior", "a"]);
    expect(front.exterior).toBe(true);
    expect(front.ambiguous).toBe(false);
    expect(front.straddles).toEqual(["a", "b"]);
    const s = describePlan(TEE);
    expect(s.doors.find((d) => d.id === "front")).toMatchObject({ between: ["exterior", "a"], straddles: ["a", "b"] });
    expect(s.access.entrances).toEqual(["front"]);
    expect(codes(TEE)).not.toContain("W_NO_ENTRANCE");
  });

  it("C.4: an exterior door beside a partition's end opens into the room its inner face is in", () => {
    const d = edgeOf(CORNER, "d")!;
    expect(d.between).toEqual(["exterior", "b"]);
    expect(d.exterior).toBe(true);
    expect(d.straddles).toEqual(["a", "b"]);
    expect(describePlan(CORNER).access.entrances).toEqual(["d"]);
    expect(codes(CORNER)).not.toContain("W_NO_ENTRANCE");
  });

  it("a door honestly joining two rooms on a partition keeps its pair and carries no straddles", () => {
    for (const [src, id] of [
      [TEE, "inner"],
      [CORNER, "d2"],
    ] as const) {
      const e = edgeOf(src, id)!;
      expect(e.between).toEqual(["a", "b"]);
      expect(e.exterior).toBe(false);
      expect(e).not.toHaveProperty("straddles");
      expect(describePlan(src).doors.find((d) => d.id === id)).not.toHaveProperty("straddles");
    }
  });

  it("a door whose jamb meets the partition's face does not straddle it", () => {
    // Clear span 4050..4950: the partition's band (3950..4050) ends at the jamb.
    const src = TEE.replace("door id=front on shell at 4000", "door id=front on shell at 4500");
    const front = edgeOf(src, "front")!;
    expect(front.between).toEqual(["exterior", "b"]);
    expect(front).not.toHaveProperty("straddles");
    expect(codes(src)).not.toContain("W_NO_ENTRANCE");
  });

  it("the probe reads a polygon room's shape, not its bounding box", () => {
    const src = `plan "L" {
  units mm
  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,6000) (0,6000) close }
  wall id=pv partition thickness 100 { (4000,3000) (4000,6000) }
  wall id=ph partition thickness 100 { (4000,3000) (8000,3000) }
  room id=l polygon (0,0) (8000,0) (8000,3000) (4000,3000) (4000,6000) (0,6000) label "Living"
  room id=n at (4000,3000) size 4000x3000 label "Study"
  door id=d at (4100,6000) width 900 wall shell
  door id=d2 at (6000,3000) width 800 wall ph
}`;
    const { ir } = resolvePlan(src);
    const rooms = ir!.elements.filter((e): e is RRoom => e.kind === "room");
    const roomRects = new Map(rooms.map((r) => [r.id, roomBox(r)] as const));
    // The control: the L's BOUNDING BOX holds the inner face's centre probe (and the whole
    // clear span), so a bbox reading would hand the door to the L. Its floor does not.
    const probe = { x: 4100, y: 5800 };
    expect(pointInRect(probe.x, probe.y, roomRects.get("l")!)).toBe(true);
    expect(pointInRoomBox(probe, roomRects.get("l")!)).toBe(false);
    const d = ir!.elements.find((e): e is RDoor => e.kind === "door" && e.id === "d")!;
    expect(connectorConnection(d, roomRects, DEFAULT_TOL)).toEqual({
      between: ["exterior", "n"],
      ambiguous: false,
      straddles: ["l", "n"],
    });
    expect(edgeOf(src, "d2")).toMatchObject({ between: ["l", "n"], exterior: false });
    expect(edgeOf(src, "d2")).not.toHaveProperty("straddles");
    expect(codes(src)).not.toContain("W_NO_ENTRANCE");
  });

  it("a connector with no host wall keeps the edge-touch answer", () => {
    const { ir } = resolvePlan(CORNER);
    const rooms = ir!.elements.filter((e): e is RRoom => e.kind === "room");
    const roomRects = new Map(rooms.map((r) => [r.id, roomBox(r)] as const));
    expect(connectorConnection({ at: { x: 4100, y: 3000 }, host: null, width: 900 }, roomRects, DEFAULT_TOL)).toEqual({
      between: ["a", "b"],
      ambiguous: false,
    });
  });
});
