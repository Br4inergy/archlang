# Reproductions

Minimal sources behind `../evidence.md`. They are evidence, not examples: no test walks this folder.
When PS1.1 builds `test/defect-corpus/`, reduce these further and move them there.

Lint as of `main@98bd30b`:

| File | What it shows | Lint |
|---|---|---|
| `family-apartment.arch` | Reconstruction of a published AI-generated plan; ten silent defects (`../evidence.md` §1) | Fixture rotation only (reconstruction artefacts) |
| `door-on-tee.arch` | A door centred on an exterior-wall T-junction reads as an interior `a↔b` door (PS0.1); a window overlaps it | `W_NO_ENTRANCE` only |
| `door-beside-tee-window-overlap.arch` | Door moved off the tee; the window still overlaps it by 250 mm | `[]` |
| `widen-before.arch` / `widen-after.arch` | `let AW` 4000 → 4500 with a relational neighbour: room leaves the shell, partition inside a room, door loses `between` | `[]` / `W_ROOM_DISCONNECTED` |
| `gallery-bench-pinch.arch` | Bench in a gallery opening leaving about 500 mm diagonally (PS0.8); re-measure, since this reduced copy does warn | `W_PATH_TOO_NARROW` |

Two drills need no file. Apply them to `examples/studio.arch`:

- **Widen:** in `examples/studio.arch`, change `size 4000x6000` on `r_living` to `size 4500x6000`.
- **Lying dimension:** in the same file, change `text "4000"` on the top `dim` to `text "4500"`.
