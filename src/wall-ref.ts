/**
 * How a hint, a fix or a suggestion names a wall (ADR 0028 §3, "Addressing").
 *
 * An authored wall is named by its id, as every such text always has: `wall "<id>"`. A wall
 * that `walls from rooms` DERIVED has no id an author can type (`exterior`, `A|B`, … are
 * internal), so it is named by its relation instead: `the partition between "A" and "B"`,
 * `the exterior wall derived from the rooms`. A text that would WRITE a wall reference into
 * the source (`on <wall> at …`, an attach fix) must not be produced for a derived wall at
 * all; {@link isDerivedWall} is the test.
 */

import type { RWall } from "./ir.js";

/** The derived marker of the wall with this id, or undefined for an authored (or unknown) one. */
export function derivedOf(walls: readonly RWall[], id: string): RWall["_derived"] {
  return walls.find((w) => w.id === id)?._derived;
}

/** True when the wall with this id was derived by `walls from rooms`. */
export function isDerivedWall(walls: readonly RWall[], id: string): boolean {
  return derivedOf(walls, id) !== undefined;
}

/**
 * The phrase that names a wall in prose: `wall "<id>"` for an authored wall (byte for byte the
 * text every rule wrote before derived walls existed), its relation for a derived one.
 */
export function wallRef(walls: readonly RWall[], id: string): string {
  const d = derivedOf(walls, id);
  if (d === undefined) return `wall "${id}"`;
  if (d.between) return `the partition between "${d.between[0]}" and "${d.between[1]}"`;
  return d.ring === "inner" ? "the courtyard wall derived from the rooms" : "the exterior wall derived from the rooms";
}
