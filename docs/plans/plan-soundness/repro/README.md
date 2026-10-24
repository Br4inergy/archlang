# Reproductions

Minimal sources behind `../evidence.md`. They are evidence, not examples: no test walks this folder.
When PS1.1 builds `test/defect-corpus/`, reduce these further and move them there.

Lint as of `main@98bd30b`, except the `door-on-tee.arch` row, which is as of the PS0.1 branch
(`fix/between-face-probes`):

| File | What it shows | Lint |
|---|---|---|
| `family-apartment.arch` | Reconstruction of a published AI-generated plan; ten silent defects (`../evidence.md` §1) | Fixture rotation only (reconstruction artefacts) |
| `door-on-tee.arch` | A door centred on an exterior-wall T-junction reads as an interior `a↔b` door (PS0.1); a window overlaps it | `[]` since PS0.1 (was `W_NO_ENTRANCE`): the door is `between ["exterior", "a"]`, `straddles ["a", "b"]` |
| `door-beside-tee-window-overlap.arch` | Door moved off the tee; the window still overlaps it by 250 mm | `[]` |
| `widen-before.arch` / `widen-after.arch` | `let AW` 4000 → 4500 with a relational neighbour: room leaves the shell, partition inside a room, door loses `between` | `W_HABITABLE_NO_WINDOW` on `a` (under current rules) / that, plus `W_ROOM_DISCONNECTED`, `W_BOUNDARY_NO_WALL` and `W_ROOM_OUTSIDE_SHELL` on `b` |
| `gallery-bench-pinch.arch` | Bench in a gallery opening leaving about 500 mm diagonally (PS0.8); re-measure, since this reduced copy does warn | `W_PATH_TOO_NARROW`; since PS2.10 (PR #243) also `W_DIM_TEXT_MISMATCH` twice: its two straight window dims are lettered with the width along the arc. Left as a frozen repro |

The impact drill: `archlang impact docs/plans/plan-soundness/repro/widen-before.arch --set AW=4500`
(the same report as `archlang impact …/widen-after.arch --against …/widen-before.arch`). Its complete
human report and JSON are pinned in `test/impact.test.ts`.

Two drills need no file. Apply them to `examples/studio.arch`:

- **Widen:** in `examples/studio.arch`, change `size 4000x6000` on `r_living` to `size 4500x6000`.
- **Lying dimension:** in the same file, change `text "4000"` on the top `dim` to `text "4500"`.
