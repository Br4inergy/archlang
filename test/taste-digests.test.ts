/**
 * The taste digest table (ADR 0032; design §4): SHA-256 of `JSON.stringify(taste(src, { profile
 * }))` for every shipped example, every defect-corpus file and every taste-corpus file, under
 * every profile, pinned below.
 *
 * Measured on the PS5.1b tree (all eleven criteria under `generic`) with this file's own digest body,
 * `tasteDigest` in `./taste-sources.ts`, never a lookalike. Each row is `[digest, profile, file]`
 * (digest first, so no file name that contains a key-like word sits before an opaque literal).
 *
 * A moved row is a finding: the PR that moves it explains the move per criterion (the criterion
 * values before and after, not just the hashes) and never re-pins to green (AGENTS.md). A new
 * criterion moves every row it assesses; a new corpus file adds a row; a new profile adds a block.
 * The table is checked both ways: a row whose file is gone and a file with no row both fail.
 *
 * Re-measured once, in PR #244's review round 1: R7's evidence now says `heights default` per
 * room (only when that room's own windows stand at 900/2100), where the first table said it for
 * every room of a plan that authored no heights. 21 rows moved, and in every one the only change
 * is that suffix: dropped from a windowless room, or added to a room whose windows stand at the
 * defaults in a plan that authors heights elsewhere (checked by stripping it from both reports
 * and comparing the rest byte for byte); no score, message or skip moved.
 *
 * Re-measured in PR #243 (plan-soundness PS2.10, `W_DIM_TEXT_MISMATCH`, a drafting-layer rule):
 * one row, `generic · defect-corpus/annotation-collisions/dim-text-lies.arch`. Its report gains
 * `validity.drafting` = `{ warnings: 1, codes: ["W_DIM_TEXT_MISMATCH"] }` (was `{ warnings: 0,
 * codes: [] }`); with that block emptied again the report equals its clean twin's byte for byte,
 * which is the row's previous digest (`04f26bd5…`, the twin's row). `score` (0.5, capped by the
 * validity-layer `W_ROOM_NO_FIXTURE`), `uncapped`, every criterion and skip are unchanged: a
 * drafting code never caps. No other row moved; the two examples PS2.10 fixed (`aquarium`,
 * `gallery-l`) changed only their drawing, which no taste criterion reads.
 *
 * PS2.12 (PR #245) moved three defect-corpus rows and added four. `label-over-bed`,
 * `label-over-wc` and `title-overflow` now carry their new drafting-layer warning
 * (`W_ANNOTATION_OVERLAP`, `W_ANNOTATION_OVERLAP`, `W_TITLE_OVERFLOW`) in `validity.drafting`:
 * warnings 0 → 1 and the code listed. Removing that one warning and code from each report
 * reproduces the old digest exactly, so no criterion, score, cap or message moved (drafting never
 * caps). The four new rows are the radius pairs; each defect case lists one
 * `W_ANNOTATION_OVERLAP` under `validity.drafting`, each twin none.
 *
 * Re-measured in PS5.1b (the eight remaining criteria: R6, R9, R11, R12, R15, R16, R17, R18):
 * EVERY row moved, because every report gains eight `criteria` entries, and with them its
 * `subscores`, `score`, `uncapped`, `coverage.weight` and `coverage.skipped` (the new criteria's
 * skips). Checked row by row against the PS5.1a code on `origin/main` (a script over every file
 * of this table, not a lookalike): the R3, R7 and R14 entries, `validity` and the PS5.1a skips are
 * byte-identical in all 200 reports; only what the new criteria add or feed moved. The PR lists
 * each file's per-criterion values and its total before and after. Sixteen rows are new: the
 * `test/taste-corpus/` pairs of the eight criteria (`r6-…` to `r18-…`). The per-row notes of the
 * earlier re-measures are folded into this header.
 *
 * Re-measured in PS5.1b's red-team round 1: R9's and R17's `source` now cite where the [S] mark
 * was checked (Palladio I.xxi via Wittkower part IV; Ching ch. 7 § Datum). Every row moved, and
 * only by those two strings: with R9's and R17's `source` emptied, all 200 reports equal the
 * previous head's byte for byte (a script over every file of this table).
 *
 * Re-measured in round 2, by the lead's ruling that a source ships only when someone read it:
 * R9's `source` now names the article actually read (Mitrović, Nexus Network Journal 6(2), 2004,
 * on Palladio I.xxi) and R17's names Brandão 2008 alone (Ching is kept in the doc comment as
 * "[M] not shipped"). Every row moved, again only by those two strings: with R9's and R17's
 * `source` emptied, all 200 reports equal round 1's head (0ea92298) byte for byte.
 */

import { describe, expect, it } from "vitest";
import { TASTE_PROFILE_NAMES } from "../src/index.js";
import { TASTE_SOURCES, tasteDigest } from "./taste-sources.js";

const TABLE: ReadonlyArray<[string, string, string]> = [
  ["d80988912bf82ee953ba3a65149162d869546b37afc04a6b3802307372739719", "generic", "examples/accessible.arch"],
  ["efc3a0e610f10efc4729d5a6159b03824b2529acd213a2c62faba115ec6e6d70", "generic", "examples/aquarium.arch"],
  ["d870bbdd2586a62dc1e1246068659ba2fa274441649e6669c3f54e31b17df61e", "generic", "examples/attached.arch"],
  ["187f227215ce651a41418c80758f2132d837c01549c2c52ef5bd436abe41eca6", "generic", "examples/bungalow.arch"],
  ["0c646158e6eded1eb264481288b34fdc8301748670547510a8a193ff5a3b62d8", "generic", "examples/classroom-block.arch"],
  ["0cab25e38f53e2e89953fbfb9944c5e65efa724a6bbd47556bb8a07c4920c761", "generic", "examples/clinic.arch"],
  ["9f9b7a7b64439ac86dc260add0a0e8cbf923fbbbfbb974b022d8be38082d9770", "generic", "examples/corner-cafe.arch"],
  ["4cf1aa6c240e46bae91d0ab67f2ae079dd973692f98188fb7a21100d03d24272", "generic", "examples/courtyard-house.arch"],
  ["3196c0a1c40ecb5ce61e418c161edd97be7fe6fc0e80e96586f3ce2f9b59ebba", "generic", "examples/furnished-flat.arch"],
  ["e4e6da6e17b1b36ca69410044e80e851deb624c2d0ff79c773f6f5c2aa003a51", "generic", "examples/gallery-l.arch"],
  ["5f9e6dabf2962f4c3a90f5b879232b5d05c7af6babbee8766980f59551833cbb", "generic", "examples/garden-house.arch"],
  ["0f60f5a9f68e6b7ea2eaf1128531449141831248dd7c90f9c8b56e4072072fa4", "generic", "examples/garden-loft.arch"],
  ["b47f84f6b6b3d23388dac71a8fe7820a9df4fc6d767b35aaef612ed7b9c04aef", "generic", "examples/hexagon-pavilion.arch"],
  ["df708fd3992a25134c166bbb24a6d4e63be1177df544a131e398a25cc39e2bba", "generic", "examples/hillside-villa.arch"],
  ["791d5c50b474f2c187df63940ccd669a68761d5d6b081dab90f361ddbbb10735", "generic", "examples/imports.arch"],
  ["38d6e8eb4c8aa81addd4190e6d9b80dd525cc62d3d4c4e77c32827f173ae0e03", "generic", "examples/laneway-house.arch"],
  ["c28f1b6c03abceb451d14cdb946f4168ea07b005415d3010ae0e76778864c180", "generic", "examples/library.arch"],
  ["b61384669de378a9dcb3fe21575615fbdf6b72ff97df5b7667fd63f1313debbe", "generic", "examples/materials.arch"],
  ["a197d8e4857e008650c7dd16559622549d8815a20c225310fbf85236ead226a8", "generic", "examples/museum-wing.arch"],
  ["89c3cb21e8a625f1fdd574170f8b7326e1b6a5478577bf3d95c2268ed1055a44", "generic", "examples/museum-wings.arch"],
  ["79a7dd121f9ae6a1f755e641a7acab995205e13680fcd84c8640914ff51789f4", "generic", "examples/museum.arch"],
  ["290a240f331beb35799d79d76e6dbbf79440033ec6e6b717f533fac8875cb49f", "generic", "examples/one-room.arch"],
  ["4beb4fcd83b89912e1e3fb03dab62239c0108789541400db9ab0657f2becb953", "generic", "examples/parametric.arch"],
  ["a5ef110531c0ccb7cb9c40580ca4b5a887522baa3a21e4204a3652cc2a0ca4ff", "generic", "examples/practice-office.arch"],
  ["f181b6dc7a3e6fb360f28c49d264250e022052a07d5e9c5538cf09b185db2a54", "generic", "examples/relational.arch"],
  ["805147a393adc8234322e0638409e74621ac698cc5f3f401ff1d305800be8636", "generic", "examples/sheet-notes.arch"],
  ["97d75cac716e67fbaa99ed74f6e1694c0135238c2a13bafcf06eab147bf6406a", "generic", "examples/studio.arch"],
  ["6d8fc2e54ce83a8228a025fb7be5a258f2cc772880298b2871c1b7fc354199ed", "generic", "examples/terrace-row.arch"],
  ["8108392464b97e022edbbd5500a40d32cf328e6515bad96eab6cffe08cfc256c", "generic", "examples/themed.arch"],
  ["da2bd1b8f7b0e9198b1c66e045a5830f943894c707d9b348eda8b4690d09fe6a", "generic", "examples/tiny-house.arch"],
  ["85872c4976afb17d18b189240ccc2891c0506f1a41de23a46a70a423bf1fabc8", "generic", "examples/townhouse.arch"],
  ["74c9749a26ec9f777e9e9b969216e4b24fafd8fc4ed1499a255075e48f0bb53e", "generic", "examples/transit-hall.arch"],
  ["1b5a551caf4aa0fb26334d09c73a5ba5976974b0e0b6004b657a6aaedb60e68d", "generic", "examples/two-bed.arch"],
  ["8182fd4afa382cffc0ce870434dedd5bdc13f4d407f903c5da70c42ab78f227f", "generic", "examples/two-storey.arch"],
  [
    "c97a65a2d2ec56ec1a770781968a68b2a4436ac5cd758d384acf69f47d43ee03",
    "generic",
    "test/defect-corpus/annotation-collisions/auto-dims-in-room.arch",
  ],
  [
    "c97a65a2d2ec56ec1a770781968a68b2a4436ac5cd758d384acf69f47d43ee03",
    "generic",
    "test/defect-corpus/annotation-collisions/auto-dims-in-room.clean.arch",
  ],
  [
    "75f0a7a773eb2d501bc9c133bba913c4184866869697787ed3ed1949aa50af8b",
    "generic",
    "test/defect-corpus/annotation-collisions/dim-text-lies.arch",
  ],
  [
    "49ff2b38c98b25cdd64c10ebadff15fc5c07a074df406c50090cdce69a3d5df7",
    "generic",
    "test/defect-corpus/annotation-collisions/dim-text-lies.clean.arch",
  ],
  [
    "b5918bcb73d92db6a8d7bda65c5dab60a10fcb69e9291fcac2a67e6378921518",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-bed.arch",
  ],
  [
    "0cb6c1ff6409b5ebf76d93f7f0e8c128c1e42764376ed10f3a44c57493dbd270",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-bed.clean.arch",
  ],
  [
    "c626da199d7f1e1ca3685202cd248f1be7c4ea2d454a8be5963f81a82cb696c1",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-wc.arch",
  ],
  [
    "6c6c26a42633711dc46a28ccf884271a30b8e18fe7077ffbfd8c3167d5dc9fc2",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-wc.clean.arch",
  ],
  [
    "d99d9b755f3117933bf381eca5b07d351dd69e37b037d67d1a97aa990ef939fb",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-label.arch",
  ],
  [
    "9f3328c63114f9fc449d123a917b0e428ab584204070e75300d5378c0dcb8ff3",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-label.clean.arch",
  ],
  [
    "d99d9b755f3117933bf381eca5b07d351dd69e37b037d67d1a97aa990ef939fb",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-piece.arch",
  ],
  [
    "9f3328c63114f9fc449d123a917b0e428ab584204070e75300d5378c0dcb8ff3",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-piece.clean.arch",
  ],
  [
    "a63e8a7874b3a41578e66eed17687827ea02dd94414a7f2af441d4e1f7618166",
    "generic",
    "test/defect-corpus/annotation-collisions/title-overflow.arch",
  ],
  [
    "848d1a48cb2760c569121dd92235253ff58e1dcc61bec24c78697db5a614c3a4",
    "generic",
    "test/defect-corpus/annotation-collisions/title-overflow.clean.arch",
  ],
  [
    "a730007689c4418749c6396c28b8c4d5800e6db554900ba3c7269a8a902dd3fa",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-door-off-kitchen.arch",
  ],
  [
    "c2ab4db7b41d390e8f25619514da321b341c398a1e0292101b21a5256503a167",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-door-off-kitchen.clean.arch",
  ],
  [
    "82ca4d29a5e7414d0fbf6905680ad1dac7f4d2e2276ea2ff73921b9954ec0567",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-leafless-to-living.arch",
  ],
  [
    "234caa1c5fb0d12514bf02cae84739a364b49348a4e009927ff508429ccf0b0a",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-leafless-to-living.clean.arch",
  ],
  [
    "99494e384d0a000f70f29478fb06d11cc2efa51f8c0322a1f53e5b2de43d7baf",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-off-open-plan.arch",
  ],
  [
    "7abd076d002c2381ee6007718e8c39929015fd95c9aed51cd95f1c949e7685ca",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-off-open-plan.clean.arch",
  ],
  [
    "b4182ef69f3b2fa45e255e675731812a35cd4b39e71297399e0a9c1cdc1c2241",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-via-bedroom.arch",
  ],
  [
    "a7df0bf88a4f079d94cd0f97da337a72a8bf5c41f35a918d6e175fa04c0e51d5",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-via-bedroom.clean.arch",
  ],
  [
    "2c3f900123f3ddb1a0009545c77a224b93058ac2592cefa7276e144e43e59358",
    "generic",
    "test/defect-corpus/circulation-privacy/bedroom-via-bedroom.arch",
  ],
  [
    "81364ac9aba22562868f632fa05972c6f89e1a16db3b228817a8b7eda38c3879",
    "generic",
    "test/defect-corpus/circulation-privacy/bedroom-via-bedroom.clean.arch",
  ],
  [
    "f71aaba4520f59654a7567bb3d7b1f3c2e6dce71cb2b20d93c262b95ca5b743b",
    "generic",
    "test/defect-corpus/circulation-privacy/entry-into-bedroom.arch",
  ],
  [
    "b40fed54d52226a733208ccf7cd53bb6f6302a6d7e9a47c83ef09a4c3a46a44a",
    "generic",
    "test/defect-corpus/circulation-privacy/entry-into-bedroom.clean.arch",
  ],
  [
    "2dbb3a7ed2b961ec9b37c12dc8dcdc094210ac240f2d9e6fb943dc9d5499876d",
    "generic",
    "test/defect-corpus/circulation-privacy/fire-door-inward.arch",
  ],
  [
    "2dbb3a7ed2b961ec9b37c12dc8dcdc094210ac240f2d9e6fb943dc9d5499876d",
    "generic",
    "test/defect-corpus/circulation-privacy/fire-door-inward.clean.arch",
  ],
  [
    "a20b91319129775618410f3303cb349aeb7d0485458828c18cbf729584c3be50",
    "generic",
    "test/defect-corpus/circulation-privacy/living-via-bedrooms.arch",
  ],
  [
    "abf1bb59d8fd6d22f5ae63f03eb967548eab229a43ce7ac17dbc5292567cbb28",
    "generic",
    "test/defect-corpus/circulation-privacy/living-via-bedrooms.clean.arch",
  ],
  [
    "b3947dcb8622a8387e9aa4d863aa025986f906225b6951d237f0a96feb78ad03",
    "generic",
    "test/defect-corpus/circulation-privacy/two-bed-chain.arch",
  ],
  [
    "b54520e551b01ba1456edc3758472edb421ce257c9275a6eff7a55b0fc642051",
    "generic",
    "test/defect-corpus/circulation-privacy/two-bed-chain.clean.arch",
  ],
  [
    "c368f0523412903c6978f8b03082e2a7ee7d11d577c396f98161dbb491f84dbb",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-dining.arch",
  ],
  [
    "73b02d5d1c3148f5f8f29607b2991c20286e68cb9723d814c6475095f3bce949",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-dining.clean.arch",
  ],
  [
    "e39e83d31ddeb9399a902734f8b6873f732bffc6d29ac00bea271222466d08b4",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-servery.arch",
  ],
  [
    "ee9a7aa75e6a8625884728667c65f492f6063f63d99cd9814feb97d731f5ed43",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-servery.clean.arch",
  ],
  [
    "e38fc5766ba199c95ca7a9a201c581bc70a377939b82af6b99b6b9f372aaa20c",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-utility-passage.arch",
  ],
  [
    "08db83e1fff91a111d84290a2c3acf83d9120b1bba961f7e9c554ba7064f8ac3",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-utility-passage.clean.arch",
  ],
  [
    "63a62ecb49dba7717a7fee5ea16b8128c66d9109e578b4074c182e24cc505e78",
    "generic",
    "test/defect-corpus/clearances/bed-blocks-alcove.arch",
  ],
  [
    "d48149c16c3f9a53f5f13b15d8e17e6c8720f21574f723a279c2eb4348f4f1f0",
    "generic",
    "test/defect-corpus/clearances/bed-blocks-alcove.clean.arch",
  ],
  [
    "757a2d21172887e8db1653d7f12ce3d6c3dbc9007f9f1b9f45b6f9cc37982545",
    "generic",
    "test/defect-corpus/clearances/bench-across-opening.arch",
  ],
  [
    "a339e986b9c872a190ad4c7cad03205eeb63baacc0f461586d05e273db63ff21",
    "generic",
    "test/defect-corpus/clearances/bench-across-opening.clean.arch",
  ],
  [
    "a339e986b9c872a190ad4c7cad03205eeb63baacc0f461586d05e273db63ff21",
    "generic",
    "test/defect-corpus/clearances/bench-diagonal-pinch.arch",
  ],
  [
    "a339e986b9c872a190ad4c7cad03205eeb63baacc0f461586d05e273db63ff21",
    "generic",
    "test/defect-corpus/clearances/bench-diagonal-pinch.clean.arch",
  ],
  [
    "dbab753369b0a2d556049ddc45f7f0a5963cfa3bd0924ed2afe90e5b9ed6a582",
    "generic",
    "test/defect-corpus/clearances/desk-in-opening.arch",
  ],
  [
    "dbab753369b0a2d556049ddc45f7f0a5963cfa3bd0924ed2afe90e5b9ed6a582",
    "generic",
    "test/defect-corpus/clearances/desk-in-opening.clean.arch",
  ],
  [
    "443e1fe0ec7b74bd1700ff64f29cb48f7fe4499cb42af5dcab3baf5b686bd754",
    "generic",
    "test/defect-corpus/clearances/fridge-in-swing.arch",
  ],
  [
    "135fa3a49878ad8a665faf7c2802f2f40cdf9d151a9f39b30405c9c416822bf3",
    "generic",
    "test/defect-corpus/clearances/fridge-in-swing.clean.arch",
  ],
  [
    "b82b308c3e358259eceea6a84df49ac59005101fb5ef89c4d5b893b98d73f1a4",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window-end.arch",
  ],
  [
    "b82b308c3e358259eceea6a84df49ac59005101fb5ef89c4d5b893b98d73f1a4",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window-end.clean.arch",
  ],
  [
    "13cf4d1ba44c02634638aab2e2ca18a62d8924e8b496819c719d45bf5c6f0342",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window.arch",
  ],
  [
    "13cf4d1ba44c02634638aab2e2ca18a62d8924e8b496819c719d45bf5c6f0342",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window.clean.arch",
  ],
  [
    "e1ac205ea2f64701a75dc6d1444d033a445643d7a52574a4dfc5805dc92f7998",
    "generic",
    "test/defect-corpus/clearances/hob-against-fridge.arch",
  ],
  [
    "e1ac205ea2f64701a75dc6d1444d033a445643d7a52574a4dfc5805dc92f7998",
    "generic",
    "test/defect-corpus/clearances/hob-against-fridge.clean.arch",
  ],
  [
    "7e05131ca91194013ce5420bcc3933c8003f09a59358e8e7d5d797b9d4ac9e3f",
    "generic",
    "test/defect-corpus/clearances/leaf-across-doorway.arch",
  ],
  [
    "7e05131ca91194013ce5420bcc3933c8003f09a59358e8e7d5d797b9d4ac9e3f",
    "generic",
    "test/defect-corpus/clearances/leaf-across-doorway.clean.arch",
  ],
  [
    "2f4395c8c3c52b1c441267abb84dcd3d07dfd57b09b81c0e300d8557c5b61752",
    "generic",
    "test/defect-corpus/clearances/masked-route-balcony-door.arch",
  ],
  [
    "359ce63714596fb6d60c1fa9e4259120f7a03a2129853cece9a2f1c548c7e83c",
    "generic",
    "test/defect-corpus/clearances/masked-route-balcony-door.clean.arch",
  ],
  [
    "9dcf8ae46167da2150ac92f3734d6fcaff3439db35d2c1ca16877d8b4af83641",
    "generic",
    "test/defect-corpus/clearances/masked-route-patio-door.arch",
  ],
  [
    "9dcf8ae46167da2150ac92f3734d6fcaff3439db35d2c1ca16877d8b4af83641",
    "generic",
    "test/defect-corpus/clearances/masked-route-patio-door.clean.arch",
  ],
  [
    "e76a9838326f4b008588740dad5cdd9a393b911cef45d2f1afd613c7773da0fa",
    "generic",
    "test/defect-corpus/clearances/seat-facing-away.arch",
  ],
  [
    "3868e79cec6eb372561a26f2c956dfc34290740c491660a69794ff97ac66fb7d",
    "generic",
    "test/defect-corpus/clearances/seat-facing-away.clean.arch",
  ],
  [
    "28415399210cb525baee7349f45ea3c6c71934ab65252cf45e3dc0a34819ba3b",
    "generic",
    "test/defect-corpus/clearances/single-leaf-2400.arch",
  ],
  [
    "28415399210cb525baee7349f45ea3c6c71934ab65252cf45e3dc0a34819ba3b",
    "generic",
    "test/defect-corpus/clearances/single-leaf-2400.clean.arch",
  ],
  [
    "f4a12decf05913e8d89a273bc1c263a66df6ecfeab312df00d25069ed27402a3",
    "generic",
    "test/defect-corpus/clearances/sofa-transposed.arch",
  ],
  [
    "f4a12decf05913e8d89a273bc1c263a66df6ecfeab312df00d25069ed27402a3",
    "generic",
    "test/defect-corpus/clearances/sofa-transposed.clean.arch",
  ],
  [
    "b232620b474a17d10df70a1bdc0e75d034628ed2e9e74171736f1b89258e7c65",
    "generic",
    "test/defect-corpus/clearances/wardrobe-faces-bed.arch",
  ],
  [
    "b232620b474a17d10df70a1bdc0e75d034628ed2e9e74171736f1b89258e7c65",
    "generic",
    "test/defect-corpus/clearances/wardrobe-faces-bed.clean.arch",
  ],
  [
    "05614dd655aed94973439ba0a947d6f58cf469618e0cc39d51a3c54769d70af2",
    "generic",
    "test/defect-corpus/clearances/wardrobe-front-550.arch",
  ],
  [
    "05614dd655aed94973439ba0a947d6f58cf469618e0cc39d51a3c54769d70af2",
    "generic",
    "test/defect-corpus/clearances/wardrobe-front-550.clean.arch",
  ],
  [
    "1ea29b64340d269d69c671d54e051b4742ed87178770463a0c1a2d34b0058271",
    "generic",
    "test/defect-corpus/clearances/wc-centre-to-basin.arch",
  ],
  [
    "1ea29b64340d269d69c671d54e051b4742ed87178770463a0c1a2d34b0058271",
    "generic",
    "test/defect-corpus/clearances/wc-centre-to-basin.clean.arch",
  ],
  [
    "baa8149777216a242ccc7a7dfbfd16b84040ba237b821668dc2fe72e94b1c28b",
    "generic",
    "test/defect-corpus/clearances/wc-side-clearance.arch",
  ],
  [
    "baa8149777216a242ccc7a7dfbfd16b84040ba237b821668dc2fe72e94b1c28b",
    "generic",
    "test/defect-corpus/clearances/wc-side-clearance.clean.arch",
  ],
  [
    "2d5c25e3c65d1db4622c96fe657ea8cb2edc95b31202ffb3a9d0f77c7410e5b2",
    "generic",
    "test/defect-corpus/daylight/accessible-living-no-window.arch",
  ],
  [
    "20f8a21e754f579a846e0410487b382a71d07386ed50017dc2ece690f626e14f",
    "generic",
    "test/defect-corpus/daylight/accessible-living-no-window.clean.arch",
  ],
  [
    "5a831e0f1c4b6983a4e38d5f99542f58ac9d336ebaccdbaea2c43d002af1bed8",
    "generic",
    "test/defect-corpus/daylight/bedroom-no-window.arch",
  ],
  [
    "b5f2d330985c6dba448a9f80848fbed7a2a9251a926ed32381bbeeb7d3d665ab",
    "generic",
    "test/defect-corpus/daylight/bedroom-no-window.clean.arch",
  ],
  [
    "df842092aa379bab851716faa6de023dc099b47fd783c431c544f8cdfca19dcc",
    "generic",
    "test/defect-corpus/daylight/living-bay-no-window.arch",
  ],
  [
    "f5e57cd2e73d6b77d697317fc6f6363d6ef0594a375bfc1592fe8542a74031f5",
    "generic",
    "test/defect-corpus/daylight/living-bay-no-window.clean.arch",
  ],
  [
    "297a967e3373f177a2ad128f3bcdb1502a30d3d412774779ac576d5e65a0ef6d",
    "generic",
    "test/defect-corpus/daylight/living-label-no-window.arch",
  ],
  [
    "9e34240244e5111bf2800a8acfe23355ea05ed8c446d6f69f52a1eb2919e848e",
    "generic",
    "test/defect-corpus/daylight/living-label-no-window.clean.arch",
  ],
  [
    "51a288b7f003755919a78855a0144675ad2389b08cb3a137be396c27802d7a5e",
    "generic",
    "test/defect-corpus/missing-defining-contents/bath-no-shower.arch",
  ],
  [
    "2ce34c0dcce390f202014100b524cc4e519855e9a4995e1b7e939f0cff145497",
    "generic",
    "test/defect-corpus/missing-defining-contents/bath-no-shower.clean.arch",
  ],
  [
    "ec67d8bb1f4ee911e365a65ee3c2b795c91473479b7b18fa80a771dd8a0e7363",
    "generic",
    "test/defect-corpus/missing-defining-contents/bedroom-no-bed.arch",
  ],
  [
    "4d527aa0de924169fc5fe20a6bae5c946a341760bfede1d485a06d5238622382",
    "generic",
    "test/defect-corpus/missing-defining-contents/bedroom-no-bed.clean.arch",
  ],
  [
    "170bd49ec3151d4ac9bbffef1a3df1123402e5dab86d764289b160455f2af9c9",
    "generic",
    "test/defect-corpus/missing-defining-contents/dining-no-table.arch",
  ],
  [
    "53ea4a97014ac724f41378c9aa71d48a0093b5ac67d978acf9851cd035d2846e",
    "generic",
    "test/defect-corpus/missing-defining-contents/dining-no-table.clean.arch",
  ],
  [
    "e0445a042483e066d52ad2096f73f0be97f4ba085e772fd7fa449221f55a9e36",
    "generic",
    "test/defect-corpus/missing-defining-contents/kitchen-no-worktop.arch",
  ],
  [
    "6ec26f0057a4d5809107f6244ed47cb455a34390e17d73a69367f829756d73b9",
    "generic",
    "test/defect-corpus/missing-defining-contents/kitchen-no-worktop.clean.arch",
  ],
  [
    "1daa665ae44cb0af5704aafb2a99d373939a706d5b4ad87338c19032e0eef12b",
    "generic",
    "test/defect-corpus/missing-defining-contents/servery-no-sink.arch",
  ],
  [
    "ec31883fbf2995f71bab74a2b5899f755b2886c2974dd40d6cc5752c1285f7a8",
    "generic",
    "test/defect-corpus/missing-defining-contents/servery-no-sink.clean.arch",
  ],
  [
    "166e0eb0fa7fafd9dd05b68ef90ce756c11a1d49b80875d1ea0a40fe30b5df58",
    "generic",
    "test/defect-corpus/openings-ignore-walls/bifold-overlaps-window.arch",
  ],
  [
    "75dff09c7afba062bc07f6781a3d46e7b17f242bd9abd58468a76c81839cee3f",
    "generic",
    "test/defect-corpus/openings-ignore-walls/bifold-overlaps-window.clean.arch",
  ],
  [
    "c97a65a2d2ec56ec1a770781968a68b2a4436ac5cd758d384acf69f47d43ee03",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-fills-gap.arch",
  ],
  [
    "2b30a4f1c65f631be341d17fb090a3af892f7a5113ca091285e323b40a55d44f",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-fills-gap.clean.arch",
  ],
  [
    "b721fb9c200729b769b665dbd45d251e574ad393398d9f29d71c8ae212fe5be6",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-jamb-50-from-tee.arch",
  ],
  [
    "0169d37b2e6949c376247cbe612af0e4f1bddf3059e5e178b2d43e459a0334ac",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-jamb-50-from-tee.clean.arch",
  ],
  [
    "0d1ab640289e0ef70b4d1c2372316bf114ae0404d1ef8b5cc3cceaccb6827be4",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-near-l-corner.arch",
  ],
  [
    "7b31e7f090773bf45bc511f9c554ac1e6ab7cb3125e0cb30dd1107feda136a66",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-near-l-corner.clean.arch",
  ],
  [
    "c68ec02b2569977543e0285a7165949e32f84bf44bf8473ac652fa674d943a21",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-notches-tee-wall.arch",
  ],
  [
    "208336fd7d0cc84b73efe02fd7902da2db9c942fdba78ce6ef3ca404366fa15d",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-notches-tee-wall.clean.arch",
  ],
  [
    "74b2be1867062bdd95fcf3f290c50152488074a6a4a426c561c1d32571a7094e",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-on-exterior-tee.arch",
  ],
  [
    "435207870db3dbe08054d128c043d8a0b53ca1a0fac7b0ed3082830080609944",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-on-exterior-tee.clean.arch",
  ],
  [
    "e3be728375b5fbcf3ade3b0bfd1e216d708816041fd812690577359c1eae61bc",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-window-overlap-chamfer.arch",
  ],
  [
    "d0e198c5ad51ab22347974d7491ef980603758b421c429df6081d744b66d3656",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-window-overlap-chamfer.clean.arch",
  ],
  [
    "2c8fea3372aa88add768e93677471644114e99762a3c39a8a095aefc9286b3a3",
    "generic",
    "test/defect-corpus/openings-ignore-walls/double-leaf-pier-chamfer.arch",
  ],
  [
    "3398ca011ff22b6453163283730e9883c71e0660c7dd3bb80c932ee1af33f4e3",
    "generic",
    "test/defect-corpus/openings-ignore-walls/double-leaf-pier-chamfer.clean.arch",
  ],
  [
    "6227ee28d4aa5e6b11bafcbc9793797f75100ccab8e668c6ff7167f93fc10397",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-door-across-tee.arch",
  ],
  [
    "9356870d710026704f5d4004e228e4e544a8c2466885c88891abbd909f60579b",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-door-across-tee.clean.arch",
  ],
  [
    "d0b839fb187e938c3100ac7f352512dfe11c0fdd41953345d16945e2bd149054",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-window-overlaps-entry.arch",
  ],
  [
    "c535ec52944431c22e1aa27765330f313cc6ac7e4b27cea512fbb6a6f77532a2",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-window-overlaps-entry.clean.arch",
  ],
  [
    "aef935647bff4de9cbe255a55bad40196d820acc72d5b213de2793203a7cb2dd",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-between-two-tees.arch",
  ],
  [
    "1305ead51cd87694b7c03ebc38315e6a2621629186bd031f92a42f00b1962f59",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-between-two-tees.clean.arch",
  ],
  [
    "10d582281126888bb6e9c5bf34973f55efa152489f332c9724d3d72dd21e326f",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-crossed-by-partition.arch",
  ],
  [
    "a658e81ed1ebfbd4bee06d99845a1409b7fed787258a9d9405f4972a96645c2c",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-crossed-by-partition.clean.arch",
  ],
  [
    "752eba65339d0877e91b8ee166f56f4f6792e1488a57c11710966031c835e061",
    "generic",
    "test/defect-corpus/openings-ignore-walls/wc-window-crossed-by-partition.arch",
  ],
  [
    "4de0b3fe2cdce4d8e02600b5db198765084c5aac4216049d557811eda1b77bbd",
    "generic",
    "test/defect-corpus/openings-ignore-walls/wc-window-crossed-by-partition.clean.arch",
  ],
  [
    "3190d47cd055f409c5c2156ab5e7887fc555f08d9b13b8aa4de2908c5076a0b3",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-overlaps-door.arch",
  ],
  [
    "6e7f4b686843498188d1c85f9b94f59b34cc8202934f9b393bd6ec6d6e51dd91",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-overlaps-door.clean.arch",
  ],
  [
    "1bf49e7fcfc47472dc07939eab4fe27d8af0440809c4197177babdc592545895",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-past-corner.arch",
  ],
  [
    "a926435ce03d34f9880ebc0ab68d0741a35cff17e30f96584f56f2e3f8fad889",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-past-corner.clean.arch",
  ],
  [
    "dd996b73499dbc2a6f221d86e934c79c476e2b166fcf49b2f3b3c17887169b09",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-straddles-tee.arch",
  ],
  [
    "10ca2bc548a634541f62b6051d9627bab260de08fb4d4800da5267ef259b812f",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-straddles-tee.clean.arch",
  ],
  [
    "ebdfd922add920cd3b97d4c21716f646347d4f8fccad1fc45d37692c273af3b6",
    "generic",
    "test/defect-corpus/space-not-enclosed/bath-open-side.arch",
  ],
  [
    "6b520d00deb6f159f3fddf3ac2dfff65fffb1aef287ed82616e2d734864a583b",
    "generic",
    "test/defect-corpus/space-not-enclosed/bath-open-side.clean.arch",
  ],
  [
    "6904fcf25e0e03efc92e3e930ac1eda3c2e40fd651d4d96680de598225d2fc1f",
    "generic",
    "test/defect-corpus/space-not-enclosed/bow-strip-unassigned.arch",
  ],
  [
    "4105b7b443b8b16895fe9a825acd5deef26b5d3d31dc9d75972359755cef8014",
    "generic",
    "test/defect-corpus/space-not-enclosed/bow-strip-unassigned.clean.arch",
  ],
  [
    "8e5fcb500d4cc80467fe0f7f19819c51ba15f05adae20b014d8146ab0e79bfa1",
    "generic",
    "test/defect-corpus/space-not-enclosed/fa-no-wall-living-bedrooms.arch",
  ],
  [
    "a14bd014bccf48816deae771e534567f09fe54ed9cc83f074d37679042e0ca86",
    "generic",
    "test/defect-corpus/space-not-enclosed/fa-no-wall-living-bedrooms.clean.arch",
  ],
  [
    "be28a17777e54735512b81ffe6ff263502f21013fa390d4e611fdc142172f080",
    "generic",
    "test/defect-corpus/space-not-enclosed/room-past-shell.arch",
  ],
  [
    "f1480e5c99d0da1128d33081345f21cd245ccd81e13f4230eef6ee761eed4dca",
    "generic",
    "test/defect-corpus/space-not-enclosed/room-past-shell.clean.arch",
  ],
  [
    "9e65a39eb1e5333a4e9208561732eacce1bac5ec599dcfc397effd0b429a2dbd",
    "generic",
    "test/defect-corpus/space-not-enclosed/round-snug-unassigned.arch",
  ],
  [
    "96aff8f107afc8392f908315badb1a61cad8254457048683d1d3a166e64211c7",
    "generic",
    "test/defect-corpus/space-not-enclosed/round-snug-unassigned.clean.arch",
  ],
  [
    "7bd983828eb54b14eb5d810bc7109c72fe38880057e8dd66ccee06f326d4df5f",
    "generic",
    "test/defect-corpus/space-not-enclosed/widen-after-outside-shell.arch",
  ],
  [
    "138f7ee084155a6040a3aa6016f2827e88a374d8a656862d655656454f86ae62",
    "generic",
    "test/defect-corpus/space-not-enclosed/widen-after-outside-shell.clean.arch",
  ],
  [
    "858dbb7da587cbce5d65c2a03b3b699ce501c0ca80ae7fc7fe69ac7d0440edd9",
    "generic",
    "test/defect-corpus/stair-safety/stair-too-steep.arch",
  ],
  [
    "858dbb7da587cbce5d65c2a03b3b699ce501c0ca80ae7fc7fe69ac7d0440edd9",
    "generic",
    "test/defect-corpus/stair-safety/stair-too-steep.clean.arch",
  ],
  [
    "a1ba7e82669d7885e3202eb0810e4743ed29e29b6390d28b442aabb7b9fab6eb",
    "generic",
    "test/defect-corpus/stair-safety/swing-at-stair-foot.arch",
  ],
  [
    "a1ba7e82669d7885e3202eb0810e4743ed29e29b6390d28b442aabb7b9fab6eb",
    "generic",
    "test/defect-corpus/stair-safety/swing-at-stair-foot.clean.arch",
  ],
  [
    "687f25e148c8acce8ccec126741e86b846096b8d9772d187310601930f20a9a4",
    "generic",
    "test/defect-corpus/stair-safety/swing-over-stair.arch",
  ],
  [
    "687f25e148c8acce8ccec126741e86b846096b8d9772d187310601930f20a9a4",
    "generic",
    "test/defect-corpus/stair-safety/swing-over-stair.clean.arch",
  ],
  [
    "54a2e39be1bae97889726c08d5b6aab242482c8b5eec571c8aa55c23c9a77e9d",
    "generic",
    "test/defect-corpus/stair-safety/void-at-stair-head.arch",
  ],
  [
    "54a2e39be1bae97889726c08d5b6aab242482c8b5eec571c8aa55c23c9a77e9d",
    "generic",
    "test/defect-corpus/stair-safety/void-at-stair-head.clean.arch",
  ],
  [
    "a33f1447fa55b464cbd6905c82cd8f1c2c1e23283b66a19a02427d5ad25ba9cb",
    "generic",
    "test/taste-corpus/r11-kitchen-off-hall.arch",
  ],
  [
    "372fe06917799da5979dfd8182ec289294c87413193576975237fd8a6a5aa97d",
    "generic",
    "test/taste-corpus/r11-kitchen-off-hall.good.arch",
  ],
  [
    "77369762b685a04649a69d55cdf1ad2de348730adec00dd5e8a81d9d99c75c62",
    "generic",
    "test/taste-corpus/r12-single-aspect.arch",
  ],
  [
    "933e3267f017338cb4d7d10985fd4a4897900b6e235ff0256e379029a1ce3ad3",
    "generic",
    "test/taste-corpus/r12-single-aspect.good.arch",
  ],
  [
    "e46465e2944cb8da1e3a8101cf8a46533f0ed8e54ae26c4dbe9825352747c865",
    "generic",
    "test/taste-corpus/r14-living-off-to-one-side.arch",
  ],
  [
    "3a405e998ffb96ce1bfc2411ed77bbc4ad8a41d009484822491a71f886fbf2fd",
    "generic",
    "test/taste-corpus/r14-living-off-to-one-side.good.arch",
  ],
  [
    "990cbf7e61249f2bb546fbf4caec230a43f8e0d1247fb8b3c4142f5a641065a1",
    "generic",
    "test/taste-corpus/r15-bedroom-off-living.arch",
  ],
  [
    "cfe8c1b8b933d3b676dd17c5391c9a97d62bdb33c420806a71c677eec269773d",
    "generic",
    "test/taste-corpus/r15-bedroom-off-living.good.arch",
  ],
  [
    "278f67f65c68c8c946a8955609ae4f08727e220258932fb53c4619112c06f7d6",
    "generic",
    "test/taste-corpus/r16-door-mid-wall.arch",
  ],
  [
    "0a0734cc3f3948be8d7f21fef7afcc50e928535ebb0d74c736e2971c1b645113",
    "generic",
    "test/taste-corpus/r16-door-mid-wall.good.arch",
  ],
  [
    "49f8819dfad2492f8d49b62d0f5587f980d64560f0da61ef7bd496501c7cfd40",
    "generic",
    "test/taste-corpus/r17-staggered-partition.arch",
  ],
  [
    "5c57e1c5f737115e1b397fb3a1605c4a2a209131477c0bc5d2edb4398a754329",
    "generic",
    "test/taste-corpus/r17-staggered-partition.good.arch",
  ],
  [
    "ca37338bd22db682e2765aba0e8e9743507da590ab6a1f852905d620054a40e3",
    "generic",
    "test/taste-corpus/r18-l-shaped-bedroom.arch",
  ],
  [
    "728278ec0344f173fa1ae98ce3d8557d93f7e92414973a1923893a76070cfb6b",
    "generic",
    "test/taste-corpus/r18-l-shaped-bedroom.good.arch",
  ],
  [
    "a2fc5c695cdb4fa05b45fa3cbb36aa197dc419b14986026de657c652c173fc5c",
    "generic",
    "test/taste-corpus/r3-living-behind-corridor.arch",
  ],
  [
    "4fa76f941627a50d1ce3d853a291a0d050a460f4ddf3121cba0e9663867cbb89",
    "generic",
    "test/taste-corpus/r3-living-behind-corridor.good.arch",
  ],
  [
    "bc387d4e6cea35b0b3e5be2d106cb85e830c3de7ef9350319c329739ebd75448",
    "generic",
    "test/taste-corpus/r6-bed-in-kitchen.arch",
  ],
  [
    "2fd7ba7f2bab29ac682f548d1348cf0795ec8c4b7d124d7067a5119e947e74c7",
    "generic",
    "test/taste-corpus/r6-bed-in-kitchen.good.arch",
  ],
  [
    "a7cb635bb95dddfdb87bc256e77b56c77b16634432a872929997a99097850252",
    "generic",
    "test/taste-corpus/r7-small-window.arch",
  ],
  [
    "1073ffd1d0a02dd72f0aceec713bd281e7f4804fb0ac325752ede254310bb3ec",
    "generic",
    "test/taste-corpus/r7-small-window.good.arch",
  ],
  [
    "d8df87ead001b25b98eddef163755a0be57938c2fec60cb1b9525ac690d4b5b7",
    "generic",
    "test/taste-corpus/r9-long-bedroom.arch",
  ],
  [
    "d24774d2a7e09db628438bf81374b3827a758adac4e0b6de12b9fa4cdd8abf62",
    "generic",
    "test/taste-corpus/r9-long-bedroom.good.arch",
  ],
];

describe("taste digests", () => {
  it("the table covers every source under every profile, and nothing else", () => {
    const want = TASTE_PROFILE_NAMES.flatMap((p) => TASTE_SOURCES.map((s) => `${p} ${s.name}`));
    expect(TABLE.map(([, p, n]) => `${p} ${n}`)).toEqual(want);
    expect(want.length).toBeGreaterThan(150);
  });

  for (const [sha, profile, name] of TABLE) {
    it(`${profile} · ${name}`, () => {
      const s = TASTE_SOURCES.find((x) => x.name === name);
      expect(s, `${name} is no longer in the corpus`).toBeDefined();
      expect(tasteDigest(s!.src, profile)).toBe(sha);
    });
  }
});
