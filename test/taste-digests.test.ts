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
 */

import { describe, expect, it } from "vitest";
import { TASTE_PROFILE_NAMES } from "../src/index.js";
import { TASTE_SOURCES, tasteDigest } from "./taste-sources.js";

const TABLE: ReadonlyArray<[string, string, string]> = [
  ["e84b5d97d89c3f2a09604b16bc64439523d82c206775377f17451ec1ffd9b963", "generic", "examples/accessible.arch"],
  ["e83add2161653a955f800cd8062b8224a7c91451812248f77a39bc48966d48d0", "generic", "examples/aquarium.arch"],
  ["387629a391af1a2fa9c45b1f7493a37ce08820076f8cbf6b12f27d95892229d9", "generic", "examples/attached.arch"],
  ["1570bab409f8d4d9e7e8d5e6c6d72538a243f1453803150d7d894f319bfef39e", "generic", "examples/bungalow.arch"],
  ["1b94aaa2c7e3ec767adb5a22090148e42c8ef0779fd8d579a733bec2c9ca7307", "generic", "examples/classroom-block.arch"],
  ["13791d4eefadebb784386cb2c2f913b27f9b20d980e90f370346671674d64bb0", "generic", "examples/clinic.arch"],
  ["ee93a2fdf12f44d281024e638e039a3e6b2c210a7323ee8bf45758e324c7c7e5", "generic", "examples/corner-cafe.arch"],
  ["6c3f6fa586be3494c7f9c6decd79125f60c65b2d8f57240ed64af80a7e2048bc", "generic", "examples/courtyard-house.arch"],
  ["611fca8f10d3e5ebe1a43d3826570c6362042b971c3bb4f872a42c3b42a5a885", "generic", "examples/furnished-flat.arch"],
  ["f7f13e98b43a13f17a88a68a87e62c0509d34dc0cc8be7cd9bd1d51058d46a9b", "generic", "examples/gallery-l.arch"],
  ["a3f6c37dd5b7bd7998f318f2c370557f46eebf8232644d1e4cb93a83129a85cc", "generic", "examples/garden-house.arch"],
  ["7fc46b37f3733c38d11bce8c051cf4fa214076793807a301c4d47a295218116c", "generic", "examples/garden-loft.arch"],
  ["ecf000c9441387949dc9eb03d6c281676af1e0681ebcb31229836d45c21b47db", "generic", "examples/hexagon-pavilion.arch"],
  ["4d6f4e1223a2a6bcca1d8b3ddbd29ef13bfa1ea3643a16703d976d6e8498f31e", "generic", "examples/hillside-villa.arch"],
  ["f737e80046a850013dc7a444a472dc9ca67f96c938a8a7c62b2c984486ef5825", "generic", "examples/imports.arch"],
  ["7623e01ca6995ffe5a342e42e85f713d9dd05e7213ec14c15d1122a0b192dc6b", "generic", "examples/laneway-house.arch"],
  ["e137c7440e986cf56d2f0ab95885a2b3d938fb73a747ef49369529f324fe2334", "generic", "examples/library.arch"],
  ["905fc5b114e7e9d4920c71abe595d77b46ce15eec252f4070a27a05ba6f4c4b9", "generic", "examples/materials.arch"],
  ["32b0ba5efb2bd9516b5af592b753e69380b0abf63f4757325f93ba5f8a7f29dd", "generic", "examples/museum-wing.arch"],
  ["82bf74b555f6269270cfe0c0532aa36ff3ba03095e060d41ed4107c566d154e4", "generic", "examples/museum-wings.arch"],
  ["5f87f0ec18efa8a0cecdbc055362ede3df78091d0c054ca1993a7f4ecbe11e8e", "generic", "examples/museum.arch"],
  ["008c96e1803b9da546da96208b8385b540b6fda74e34cf0e8b1d1da98788c5c4", "generic", "examples/one-room.arch"],
  ["35cb1ac760df4b5f89ba55fbb18f195c26aecccb06f8ee3f313a5e3ce22a53a6", "generic", "examples/parametric.arch"],
  ["fbb3495074508f86324a488a5edd0bb5c1249929cb5748d193c9549c1709ddd9", "generic", "examples/practice-office.arch"],
  ["a9ad2ea7f554f277bb881f34cb0b1769903aebaf8601729ab47df0a940dea8c4", "generic", "examples/relational.arch"],
  ["7edc3fb1b07f459a20fb28c694db6fe0b4b59e160db6d13c8a95d24b43f485bb", "generic", "examples/sheet-notes.arch"],
  ["e99ef50fbdb8de0b14a215b593c40362f9591b5534cef66b206f3d89dc1f52d7", "generic", "examples/studio.arch"],
  ["0c870640a68ac5487dadae1100e5dcd738188f1f131ddfc59ff7dd6c23354d28", "generic", "examples/terrace-row.arch"],
  ["257eb58f72bd04b759b74aac97cb02dc84a763da551f4a4df7a835efcd7d99cf", "generic", "examples/themed.arch"],
  ["91717d6beb2f953d70f5870b19a7895adeaa53bd8ba39997814165f100126f4f", "generic", "examples/tiny-house.arch"],
  ["959f7937da3be2f1121a5d1ec7c4de3db3ee7b7d87fbae842d8f8f1832cf61f3", "generic", "examples/townhouse.arch"],
  ["315f6745d57f2909de45a42ddb7d91c6fb211192763cb16807ce9c5e601c167a", "generic", "examples/transit-hall.arch"],
  ["d23bc563a2946b50008187ce43b3379c19053f0e55aae561f56d9147f20f9ab7", "generic", "examples/two-bed.arch"],
  ["da8003f2874ddd05b34f9c5cbc3fb9138396ae6959420424fde93e1d3bfb919a", "generic", "examples/two-storey.arch"],
  [
    "a284bc5898420f844622bdfddd4ea01b1cc92eb53b01277c51a74b93194cc3c3",
    "generic",
    "test/defect-corpus/annotation-collisions/auto-dims-in-room.arch",
  ],
  [
    "a284bc5898420f844622bdfddd4ea01b1cc92eb53b01277c51a74b93194cc3c3",
    "generic",
    "test/defect-corpus/annotation-collisions/auto-dims-in-room.clean.arch",
  ],
  [
    "6d1e8534c7c8f4d58b44b469e174088b5a7ddfad96d4b195cc6f2108607a8a8e",
    "generic",
    "test/defect-corpus/annotation-collisions/dim-text-lies.arch",
  ],
  [
    "9f01f5f81f2acc05fee37cafe604713b8a351612b4ddf3cc0dd467b729b89afc",
    "generic",
    "test/defect-corpus/annotation-collisions/dim-text-lies.clean.arch",
  ],
  [
    "36f62c8a329e5228eb4b79fe01a871d9cc190c622557c6b0bb26278e76b5bea5",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-bed.arch",
  ],
  [
    "177facc84050aa71ffc72c6f72b12d0d3959b1a173d056fea08937aa0cbcb879",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-bed.clean.arch",
  ],
  [
    "a6b0f20ccd7b6f670017208da00b8b420815430d837d556ca6222f16bfe49664",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-wc.arch",
  ],
  [
    "a5d19d77961769fdbf46d31cf1e79fb746e533eb927496a5f1c35a8962da0e59",
    "generic",
    "test/defect-corpus/annotation-collisions/label-over-wc.clean.arch",
  ],
  [
    "31303e9d5d7827748b90743f146097f2fa362662aaf4a826997e5c3f686b9a40",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-label.arch",
  ],
  [
    "33c67b38d435225119aedb4a1185fafd536980c740ac4a9458a2a1411fac5ea8",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-label.clean.arch",
  ],
  [
    "31303e9d5d7827748b90743f146097f2fa362662aaf4a826997e5c3f686b9a40",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-piece.arch",
  ],
  [
    "33c67b38d435225119aedb4a1185fafd536980c740ac4a9458a2a1411fac5ea8",
    "generic",
    "test/defect-corpus/annotation-collisions/radius-over-piece.clean.arch",
  ],
  [
    "253b17c91a15bef877454964b2056b932b1c13d10ef4a27671379fe1b3ff11e2",
    "generic",
    "test/defect-corpus/annotation-collisions/title-overflow.arch",
  ],
  [
    "ccf2e2f134524e7faf1b96c33815bb69ff9c777fca3effe09a966c8c260c2d24",
    "generic",
    "test/defect-corpus/annotation-collisions/title-overflow.clean.arch",
  ],
  [
    "3decef15f4dd873a58910aaea0ce65b5b353df51be25f432cee4806aef48d9d5",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-door-off-kitchen.arch",
  ],
  [
    "8d1cb088e439b2ca9fd024600e4848e39790c0900a978748dfa269b7484bbb75",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-door-off-kitchen.clean.arch",
  ],
  [
    "49845ff31a33c9cb516b0c8d33698a0978936adf11715e417df16d2c30531157",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-leafless-to-living.arch",
  ],
  [
    "fd0a46aef75c7f32cb045d0e3b1db68eddd4e7b0c791f046e21f5107fef8fb81",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-leafless-to-living.clean.arch",
  ],
  [
    "4251a3ab7ff1bfaa2ca1620b3cf38f3c6fc35eb29d0c35a7d23c927ea454047d",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-off-open-plan.arch",
  ],
  [
    "15bc7c2dc2ac303131870ace11375ace76f6da271d913923e701402cb9925fea",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-off-open-plan.clean.arch",
  ],
  [
    "77dcfd32d9e8b3cc7417d36185419736c4ceed5c07dbdc7951f0b01fc08ac093",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-via-bedroom.arch",
  ],
  [
    "1bcfe4336546292ba06bea899b8a484872cb8caa6509360d702e50a4a7973d2b",
    "generic",
    "test/defect-corpus/circulation-privacy/bath-via-bedroom.clean.arch",
  ],
  [
    "e2c5c51bfbe54bbd9f6d10fe6caf102458d0494443f2cf7a14010187b087e9ed",
    "generic",
    "test/defect-corpus/circulation-privacy/bedroom-via-bedroom.arch",
  ],
  [
    "b805981e737d1b18788aa79c830ad85f881103ab9309ee6793902d9a1faa6f1e",
    "generic",
    "test/defect-corpus/circulation-privacy/bedroom-via-bedroom.clean.arch",
  ],
  [
    "d7276b160c11f9e48f27a045568ca179cff35fb812967a6dc091bb4275bdc633",
    "generic",
    "test/defect-corpus/circulation-privacy/entry-into-bedroom.arch",
  ],
  [
    "7983229c90de6471bdd06d79ec97201d1e8e77da03fd284adabd80192c635b9b",
    "generic",
    "test/defect-corpus/circulation-privacy/entry-into-bedroom.clean.arch",
  ],
  [
    "9fdbec498b051ead181e269890f9f883844c95267cd22661131263b75924b3e0",
    "generic",
    "test/defect-corpus/circulation-privacy/fire-door-inward.arch",
  ],
  [
    "9fdbec498b051ead181e269890f9f883844c95267cd22661131263b75924b3e0",
    "generic",
    "test/defect-corpus/circulation-privacy/fire-door-inward.clean.arch",
  ],
  [
    "8105c606ae08f273a29a25fcbbc1fde0f33fca3a98489f2ae169bd75ee549e87",
    "generic",
    "test/defect-corpus/circulation-privacy/living-via-bedrooms.arch",
  ],
  [
    "365138156b3730e4dc9aad87aee1e460b4c11eefa0fbb504ff71cde2c306c626",
    "generic",
    "test/defect-corpus/circulation-privacy/living-via-bedrooms.clean.arch",
  ],
  [
    "1d002198c1ceb4eed0578f99e27667c5891cfb3f6dd333268708dca0f552cfe9",
    "generic",
    "test/defect-corpus/circulation-privacy/two-bed-chain.arch",
  ],
  [
    "7ea1184d66ef104a174fe63c620fcd069ea3e80430513e2b0573bb7470c24f04",
    "generic",
    "test/defect-corpus/circulation-privacy/two-bed-chain.clean.arch",
  ],
  [
    "c926adeb8c011548de29cf3efce120129da927d795d63f470fe0102c08821cc0",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-dining.arch",
  ],
  [
    "00d3793e4932351412d9c6e0bcd5cfbdf911ee202edfb35dc96a5e1fd58fe062",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-dining.clean.arch",
  ],
  [
    "f43dec09d51f85153d2bbacc2bf3ff5fafc868142ee4a358d3d19e975776eed1",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-servery.arch",
  ],
  [
    "3f55b36b7156865eafadf4b1fbeb3c35eb306e7e38df5e03c68573d9c281d970",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-off-servery.clean.arch",
  ],
  [
    "da59c9b3a0eff61e5615274840b16762e42e748e603c57969510ca7c8aef80fc",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-utility-passage.arch",
  ],
  [
    "017fad98593cb47e19302392e7bbce0b517e39b2326acd0ca2dc9f76d7a39b33",
    "generic",
    "test/defect-corpus/circulation-privacy/wc-utility-passage.clean.arch",
  ],
  [
    "5b0530bf07aba02b0eb521cd9ea638aa5a43720d55f8e191223b45d49d217f3d",
    "generic",
    "test/defect-corpus/clearances/bed-blocks-alcove.arch",
  ],
  [
    "bd3f50e693cd787716d515d9a5e8fc6fc8c4dfc88c6fda0be363d433cc89ba62",
    "generic",
    "test/defect-corpus/clearances/bed-blocks-alcove.clean.arch",
  ],
  [
    "7cc830cff98e57b04ec9d1f73a614b76cab17dee9162481ca58731c7ee3d20ac",
    "generic",
    "test/defect-corpus/clearances/bench-across-opening.arch",
  ],
  [
    "b7cb0252cc9079bf7e1128149a87a9b38c1e3f580615fdac300d848cc9258f8b",
    "generic",
    "test/defect-corpus/clearances/bench-across-opening.clean.arch",
  ],
  [
    "b7cb0252cc9079bf7e1128149a87a9b38c1e3f580615fdac300d848cc9258f8b",
    "generic",
    "test/defect-corpus/clearances/bench-diagonal-pinch.arch",
  ],
  [
    "b7cb0252cc9079bf7e1128149a87a9b38c1e3f580615fdac300d848cc9258f8b",
    "generic",
    "test/defect-corpus/clearances/bench-diagonal-pinch.clean.arch",
  ],
  [
    "e9f8f6d6cb360723250c47163f793a2ffac4929ed8fafa759dc9236e98cd3f33",
    "generic",
    "test/defect-corpus/clearances/desk-in-opening.arch",
  ],
  [
    "e9f8f6d6cb360723250c47163f793a2ffac4929ed8fafa759dc9236e98cd3f33",
    "generic",
    "test/defect-corpus/clearances/desk-in-opening.clean.arch",
  ],
  [
    "4ea311a3a9e9b65b285fac3f7e84b187fe596e779616d576802f7a4596a04ed6",
    "generic",
    "test/defect-corpus/clearances/fridge-in-swing.arch",
  ],
  [
    "9393f6a89c6e8eed6f765e0b88fe1395bd219aecdf3ea169d2c86fd0f090ab41",
    "generic",
    "test/defect-corpus/clearances/fridge-in-swing.clean.arch",
  ],
  [
    "29996535e150e6e5568f66ad0cfe2cd8e97c94af37ac7118477ec6e758abd629",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window-end.arch",
  ],
  [
    "29996535e150e6e5568f66ad0cfe2cd8e97c94af37ac7118477ec6e758abd629",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window-end.clean.arch",
  ],
  [
    "601401f37754c05baeb7adbadeff7c42423c1f95fd4d22ba1a3d131b061e5822",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window.arch",
  ],
  [
    "601401f37754c05baeb7adbadeff7c42423c1f95fd4d22ba1a3d131b061e5822",
    "generic",
    "test/defect-corpus/clearances/fridge-over-window.clean.arch",
  ],
  [
    "719a110339c94cbf47aea1c2c9d46d9a7d74d2c3b5b190f0a0852ff3da2df691",
    "generic",
    "test/defect-corpus/clearances/hob-against-fridge.arch",
  ],
  [
    "719a110339c94cbf47aea1c2c9d46d9a7d74d2c3b5b190f0a0852ff3da2df691",
    "generic",
    "test/defect-corpus/clearances/hob-against-fridge.clean.arch",
  ],
  [
    "f9542eaeca9c72b5e6b579b3d7f43f84f1a45f497dd2dacca36c10622de7bd70",
    "generic",
    "test/defect-corpus/clearances/leaf-across-doorway.arch",
  ],
  [
    "f9542eaeca9c72b5e6b579b3d7f43f84f1a45f497dd2dacca36c10622de7bd70",
    "generic",
    "test/defect-corpus/clearances/leaf-across-doorway.clean.arch",
  ],
  [
    "bc773ffd6d827013619982a63cfc03100494ee4f2fdb52015b54040ac015d8ee",
    "generic",
    "test/defect-corpus/clearances/masked-route-balcony-door.arch",
  ],
  [
    "19c1422a1b490c55869b1182abdd78d0e442c78e4b9cea07d58e692f0acbc8f9",
    "generic",
    "test/defect-corpus/clearances/masked-route-balcony-door.clean.arch",
  ],
  [
    "f17cfe7832d5070ced1a926f0b444056224366112aa136f4b5ae4c81737c4872",
    "generic",
    "test/defect-corpus/clearances/masked-route-patio-door.arch",
  ],
  [
    "f17cfe7832d5070ced1a926f0b444056224366112aa136f4b5ae4c81737c4872",
    "generic",
    "test/defect-corpus/clearances/masked-route-patio-door.clean.arch",
  ],
  [
    "758531e8f92b719fbe26f3c11afb1c85cd9ed4161164d48287712e1da69426b7",
    "generic",
    "test/defect-corpus/clearances/seat-facing-away.arch",
  ],
  [
    "f1fa4b9843b3fd01921340238acdf2dbade075a55c8aa30e6440fd6b765b62e5",
    "generic",
    "test/defect-corpus/clearances/seat-facing-away.clean.arch",
  ],
  [
    "6f44b30efe11a4a1fd18626c67cc97bb9ec9babb1bb29815d7ae95fd50375876",
    "generic",
    "test/defect-corpus/clearances/single-leaf-2400.arch",
  ],
  [
    "6f44b30efe11a4a1fd18626c67cc97bb9ec9babb1bb29815d7ae95fd50375876",
    "generic",
    "test/defect-corpus/clearances/single-leaf-2400.clean.arch",
  ],
  [
    "e530b3b3cbf328d936484b4ee9d1111de8e10fbc95d0d06e12833cba537cf443",
    "generic",
    "test/defect-corpus/clearances/sofa-transposed.arch",
  ],
  [
    "e530b3b3cbf328d936484b4ee9d1111de8e10fbc95d0d06e12833cba537cf443",
    "generic",
    "test/defect-corpus/clearances/sofa-transposed.clean.arch",
  ],
  [
    "08828f8fd1c08fc49af3c2b7ece558f3d81af30a5bd347f49c6e282fc4efc1b7",
    "generic",
    "test/defect-corpus/clearances/wardrobe-faces-bed.arch",
  ],
  [
    "08828f8fd1c08fc49af3c2b7ece558f3d81af30a5bd347f49c6e282fc4efc1b7",
    "generic",
    "test/defect-corpus/clearances/wardrobe-faces-bed.clean.arch",
  ],
  [
    "94dbc91603bb93b652a186af5b699c3f331c4a5f1d727e0b87149ebdd3e0c323",
    "generic",
    "test/defect-corpus/clearances/wardrobe-front-550.arch",
  ],
  [
    "94dbc91603bb93b652a186af5b699c3f331c4a5f1d727e0b87149ebdd3e0c323",
    "generic",
    "test/defect-corpus/clearances/wardrobe-front-550.clean.arch",
  ],
  [
    "67d4913fb032e4eaaadd3ea920fa7b85e43ddb96a138f78938d609c3e6ee7a00",
    "generic",
    "test/defect-corpus/clearances/wc-centre-to-basin.arch",
  ],
  [
    "67d4913fb032e4eaaadd3ea920fa7b85e43ddb96a138f78938d609c3e6ee7a00",
    "generic",
    "test/defect-corpus/clearances/wc-centre-to-basin.clean.arch",
  ],
  [
    "448e41f54e297320f0010a976ddacd6443563c508d1d6f936a18cc1915a617d3",
    "generic",
    "test/defect-corpus/clearances/wc-side-clearance.arch",
  ],
  [
    "448e41f54e297320f0010a976ddacd6443563c508d1d6f936a18cc1915a617d3",
    "generic",
    "test/defect-corpus/clearances/wc-side-clearance.clean.arch",
  ],
  [
    "ee2036294d0ae6cb4b65b9c675bfc9937166c82009200da5d46bcf431404d0cc",
    "generic",
    "test/defect-corpus/daylight/accessible-living-no-window.arch",
  ],
  [
    "c17b895401b32f9baed6416a2ea3eeab3f02dae97867c57011273bcbc8c631d2",
    "generic",
    "test/defect-corpus/daylight/accessible-living-no-window.clean.arch",
  ],
  [
    "922706462c8c1dbb97abd39ab7146d405f2bfde79013badda2003bc59b187039",
    "generic",
    "test/defect-corpus/daylight/bedroom-no-window.arch",
  ],
  [
    "197d50a615d6ff9e8989ded6480304632c134ed233a675f6e94fb219e0c6f19b",
    "generic",
    "test/defect-corpus/daylight/bedroom-no-window.clean.arch",
  ],
  [
    "fcbae7b52263d646e6348bf13d24447426e10c8cbe9377a8b3d0efe5d8cb214a",
    "generic",
    "test/defect-corpus/daylight/living-bay-no-window.arch",
  ],
  [
    "bc6eac2093c73a390bb23cf410faddf1569c5a5f67565c42a4da855dfaa572a9",
    "generic",
    "test/defect-corpus/daylight/living-bay-no-window.clean.arch",
  ],
  [
    "30f2f22b8c45fe604c12b003d0a2b7bda2bf675d822d2aee37d50617c47f7c22",
    "generic",
    "test/defect-corpus/daylight/living-label-no-window.arch",
  ],
  [
    "dcce3ca3d8c941f4298eff0f603a939d2b11c9cb4769275ad7d2e7a130c9331b",
    "generic",
    "test/defect-corpus/daylight/living-label-no-window.clean.arch",
  ],
  [
    "81a6dc4ddb6a2a605ad23517c6515704ca8eced16028d68fef9086836d954f5c",
    "generic",
    "test/defect-corpus/missing-defining-contents/bath-no-shower.arch",
  ],
  [
    "773261cc6aa23e44f93475d8483af988d2e5eb514c814279d432c1d9ae5893e7",
    "generic",
    "test/defect-corpus/missing-defining-contents/bath-no-shower.clean.arch",
  ],
  [
    "f5a4ef3ce25b7599c21cfe9ecadde03b21e092cb0885164b2f21b4577c81f8cb",
    "generic",
    "test/defect-corpus/missing-defining-contents/bedroom-no-bed.arch",
  ],
  [
    "8a5efe7941140aea19cb810929afbfe23ab5084ff9f8768933238165ec76758b",
    "generic",
    "test/defect-corpus/missing-defining-contents/bedroom-no-bed.clean.arch",
  ],
  [
    "cb4a4efc0c414ecf178da5f33a86ad3352e90a849b669b1f12c0d8397abae961",
    "generic",
    "test/defect-corpus/missing-defining-contents/dining-no-table.arch",
  ],
  [
    "0d10dfe7427850123d90077882ef2325d77897d58485501e2c008a0817f9260f",
    "generic",
    "test/defect-corpus/missing-defining-contents/dining-no-table.clean.arch",
  ],
  [
    "3f210c7f8a2fcf13ad0d121374ad5426f9b6bddc190e600cfc861d496c542b75",
    "generic",
    "test/defect-corpus/missing-defining-contents/kitchen-no-worktop.arch",
  ],
  [
    "84c7b4390826986de44f2ae0121c5fa29045d81670bac2626d27e52e224426dd",
    "generic",
    "test/defect-corpus/missing-defining-contents/kitchen-no-worktop.clean.arch",
  ],
  [
    "7b4b7d12045813cfe130d9ca55df1a016c02285b196d3c2da860db875b91d59b",
    "generic",
    "test/defect-corpus/missing-defining-contents/servery-no-sink.arch",
  ],
  [
    "5fd9b48d1a3332741b4a5c48604e3046f7090650d423364bedc69310bd5bff40",
    "generic",
    "test/defect-corpus/missing-defining-contents/servery-no-sink.clean.arch",
  ],
  [
    "ed7cd65cac9388f05d7381d58acb6dcc673ec9eaffc4952d6448f8aa8f1983c5",
    "generic",
    "test/defect-corpus/openings-ignore-walls/bifold-overlaps-window.arch",
  ],
  [
    "bdf3b157a1671aaa214e71ff43ad3c3be1faa4aca86eae02bc4048f7693b8206",
    "generic",
    "test/defect-corpus/openings-ignore-walls/bifold-overlaps-window.clean.arch",
  ],
  [
    "a284bc5898420f844622bdfddd4ea01b1cc92eb53b01277c51a74b93194cc3c3",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-fills-gap.arch",
  ],
  [
    "8cd8f1910926d99050937db68c31b176933c21859ba60dd5cf5d43100b7b4663",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-fills-gap.clean.arch",
  ],
  [
    "23b65c15550e2eac9c01ebd6697c7da54a2df07d7c8b39670529190a47d58f83",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-jamb-50-from-tee.arch",
  ],
  [
    "8bdbff3e5e57d3a051dc946777319e9b94356951d63fabbba57c29a7a1696233",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-jamb-50-from-tee.clean.arch",
  ],
  [
    "0a2a23edd94372b77f5b251d29ad6d01f789299d0b2f7d469e582b8100a1329f",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-near-l-corner.arch",
  ],
  [
    "bac3ef3e8a5d459cf4ceb5771fce9d3da80176ef0f6f188cc90f94dccc4b7887",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-near-l-corner.clean.arch",
  ],
  [
    "cb9e716387604d4d02a4e3f797dd270eda6a117fe3463925a5bb8502bc069c4c",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-notches-tee-wall.arch",
  ],
  [
    "2d4c50cb242b68868917466f6ba9c9308a86f989c9a6ace37861f683004d3feb",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-notches-tee-wall.clean.arch",
  ],
  [
    "dc3545d6800954d215c3e55ac65843716c00b370b909512e2e9ef3268ba51129",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-on-exterior-tee.arch",
  ],
  [
    "e6cd11f6b47c520ad17fadd31122e60a61e012ca11cb3bc96e9747fb81e4553c",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-on-exterior-tee.clean.arch",
  ],
  [
    "e69c4d8489230bcb456b473cc88bc8caecc432eeec57fc04ee8586f18615563e",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-window-overlap-chamfer.arch",
  ],
  [
    "a4eac2dc096565cdf68eb516e6777b5e5707497388c880d16dd88d406d6a7be0",
    "generic",
    "test/defect-corpus/openings-ignore-walls/door-window-overlap-chamfer.clean.arch",
  ],
  [
    "b8f54fab8ce7912abcfdc61cb8ab6b7155b85c2fdab6cb02f78bd2b1da7b3caa",
    "generic",
    "test/defect-corpus/openings-ignore-walls/double-leaf-pier-chamfer.arch",
  ],
  [
    "618d591fc6ed1e2edf0183253e71be93e6fe430704074875d182e92a35c30e45",
    "generic",
    "test/defect-corpus/openings-ignore-walls/double-leaf-pier-chamfer.clean.arch",
  ],
  [
    "fe81e6cda825c25ed01e9aa1df11c0eb6b930f0b6841aa07e66dba0004270281",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-door-across-tee.arch",
  ],
  [
    "f8a52ade0a05af78ec64ecce4f9ce2cd3607d31ade3b5a565f953a0b14555a3b",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-door-across-tee.clean.arch",
  ],
  [
    "50c7d3933f7c74123c6cb1eae6459e1a929625c8108156d89cf7e5a0eb873ff3",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-window-overlaps-entry.arch",
  ],
  [
    "031ed7b46ece9069a6f027c10afc3d2d6f4d746cd68dc0ff2abcb68f011009af",
    "generic",
    "test/defect-corpus/openings-ignore-walls/fa-window-overlaps-entry.clean.arch",
  ],
  [
    "4d6a6136a105132cf37ab541a247dfa07a72229acbc0f570bfa4084bb423b483",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-between-two-tees.arch",
  ],
  [
    "93914ecc146cdccb891d49190430d44cd1fcb9664c92ef8ebd109d2c25fa5f61",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-between-two-tees.clean.arch",
  ],
  [
    "bf25462fdb0197645f4d8aa27587e3f81f407a5e33f2588a4320dd1b92d79686",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-crossed-by-partition.arch",
  ],
  [
    "a186c31abe9948a43a63b89b8ef422482da4ef69dfc6ea665a2899448eb6d4c8",
    "generic",
    "test/defect-corpus/openings-ignore-walls/opening-crossed-by-partition.clean.arch",
  ],
  [
    "01c844c9f773012f6f7e5d48bbb3402c2331b05fa9d5415d2474cc68eb70e30d",
    "generic",
    "test/defect-corpus/openings-ignore-walls/wc-window-crossed-by-partition.arch",
  ],
  [
    "cb68fccc908763f623b46d8b5299ddc396b2664e833fb4f95382f51040a12225",
    "generic",
    "test/defect-corpus/openings-ignore-walls/wc-window-crossed-by-partition.clean.arch",
  ],
  [
    "d7fe404a68487af27d5b9bee4999c0fd466d3394d57e2d03621f948cb7308255",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-overlaps-door.arch",
  ],
  [
    "657f7cc94999f70b32fe8ead34ed6442d12fee54d5e0ee045d40f540be9bbe94",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-overlaps-door.clean.arch",
  ],
  [
    "21ec1087bed3212d79ffe96752d417e3f467f008544133b7cd5a8a2545f6bfcf",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-past-corner.arch",
  ],
  [
    "d142bc4bc5aadb70b330f237d86e9d21915001f0f006552e9cb95e4dc91ba09d",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-past-corner.clean.arch",
  ],
  [
    "a781070a6936f26e49de05a235919ca7b1be0f3b8e64f3871aff2cf73f23acc3",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-straddles-tee.arch",
  ],
  [
    "ef69847198e2fc95cf68caef21e68d03bd45f7550ce7bb677c278246723129a1",
    "generic",
    "test/defect-corpus/openings-ignore-walls/window-straddles-tee.clean.arch",
  ],
  [
    "199d61fe21a27b584f30257a125554cbb3d1613e098430297bac67c92ac4742b",
    "generic",
    "test/defect-corpus/space-not-enclosed/bath-open-side.arch",
  ],
  [
    "d881652e4ef0f8c9fa845f086971c70fef606e9a65fc84417cacc167d3535c24",
    "generic",
    "test/defect-corpus/space-not-enclosed/bath-open-side.clean.arch",
  ],
  [
    "c8bd71d30a7472306d66b08bed5e9042854aecfe661ee7b6ec0d7564a6a35cf1",
    "generic",
    "test/defect-corpus/space-not-enclosed/bow-strip-unassigned.arch",
  ],
  [
    "ac12fe09177694c0fabdef793d9fe201acb8646bcbabde79ed28d88ba6128938",
    "generic",
    "test/defect-corpus/space-not-enclosed/bow-strip-unassigned.clean.arch",
  ],
  [
    "cf80de810870e7a648bc4c6b03e8bd3523d5fc806be8fff592db7ee149eb021d",
    "generic",
    "test/defect-corpus/space-not-enclosed/fa-no-wall-living-bedrooms.arch",
  ],
  [
    "cb3c4b3cf5d87fdf507bec53bc5b6316866fb2084eae23180a690c582ba9717d",
    "generic",
    "test/defect-corpus/space-not-enclosed/fa-no-wall-living-bedrooms.clean.arch",
  ],
  [
    "779c49344ce270ca55d61147a721709533ca163b7f937fc4e2d202f7124e06a0",
    "generic",
    "test/defect-corpus/space-not-enclosed/room-past-shell.arch",
  ],
  [
    "9491cfcc77ac60ab54c8221011f4f6a2ecc0e7fcfb98708b9a98f27df244783a",
    "generic",
    "test/defect-corpus/space-not-enclosed/room-past-shell.clean.arch",
  ],
  [
    "d0c4f8abc9dd48e5c4e2501896acde5b8945403730667c660b2701d0c82a411a",
    "generic",
    "test/defect-corpus/space-not-enclosed/round-snug-unassigned.arch",
  ],
  [
    "20bfb9bd7e5315b1ca915d5e1a27a53f2d91738794c497831c1bdba5812ba35c",
    "generic",
    "test/defect-corpus/space-not-enclosed/round-snug-unassigned.clean.arch",
  ],
  [
    "60c11d28bd8416ef4906f7c579bcfc19be9584459ec38bf6c6a5157bd3780e75",
    "generic",
    "test/defect-corpus/space-not-enclosed/widen-after-outside-shell.arch",
  ],
  [
    "bed9865db3bd7e62878c235b8564c91ef186ad42a968e56af09dbb4b7b281839",
    "generic",
    "test/defect-corpus/space-not-enclosed/widen-after-outside-shell.clean.arch",
  ],
  [
    "9f1ecf0bc51c92a17d129dc024c4654a6105724cb0fc560272bc2c4af670a06d",
    "generic",
    "test/defect-corpus/stair-safety/stair-too-steep.arch",
  ],
  [
    "9f1ecf0bc51c92a17d129dc024c4654a6105724cb0fc560272bc2c4af670a06d",
    "generic",
    "test/defect-corpus/stair-safety/stair-too-steep.clean.arch",
  ],
  [
    "0fa0f2917ab43e540daf995ef00f685936d95b9cafe3f253608d50b3d531014b",
    "generic",
    "test/defect-corpus/stair-safety/swing-at-stair-foot.arch",
  ],
  [
    "0fa0f2917ab43e540daf995ef00f685936d95b9cafe3f253608d50b3d531014b",
    "generic",
    "test/defect-corpus/stair-safety/swing-at-stair-foot.clean.arch",
  ],
  [
    "8837bcf1950e16b0a8aaddd8965501a573ea3afadbfaa289e8b66f11f43c68a7",
    "generic",
    "test/defect-corpus/stair-safety/swing-over-stair.arch",
  ],
  [
    "8837bcf1950e16b0a8aaddd8965501a573ea3afadbfaa289e8b66f11f43c68a7",
    "generic",
    "test/defect-corpus/stair-safety/swing-over-stair.clean.arch",
  ],
  [
    "81d76a32dac1dae7f48bce4293f713b73a60c5e4b07d5100f5b7f5af6f003117",
    "generic",
    "test/defect-corpus/stair-safety/void-at-stair-head.arch",
  ],
  [
    "81d76a32dac1dae7f48bce4293f713b73a60c5e4b07d5100f5b7f5af6f003117",
    "generic",
    "test/defect-corpus/stair-safety/void-at-stair-head.clean.arch",
  ],
  [
    "ce5d2dfadb62afaa62e780f34730c8766f363dc91bfcfc0247bbff925bac4fcd",
    "generic",
    "test/taste-corpus/r11-kitchen-off-hall.arch",
  ],
  [
    "451922ad9350ef1cb6e1d47d56ab9878fd77be10859e8b30c6416fce5132740a",
    "generic",
    "test/taste-corpus/r11-kitchen-off-hall.good.arch",
  ],
  [
    "0402b2dc1330a94bc82319450fe0657c8a4807f4ab7265009cad5af1133ffa22",
    "generic",
    "test/taste-corpus/r12-single-aspect.arch",
  ],
  [
    "42a09d540bebd4fdbed6ebc2511a10156abc631f32218ee828c9e090f47404d3",
    "generic",
    "test/taste-corpus/r12-single-aspect.good.arch",
  ],
  [
    "5f364c4cadde46cc8c3a504d6070c653bb43227f53b85d15b8f64f18aaf47776",
    "generic",
    "test/taste-corpus/r14-living-off-to-one-side.arch",
  ],
  [
    "e3b30efb0ca0b294151f6b7ae7721fbc54f7a95669307eec9fea5d6bbc944f8c",
    "generic",
    "test/taste-corpus/r14-living-off-to-one-side.good.arch",
  ],
  [
    "5ab3737db1e6d6fbf1f2e907e71930fb57f278c1e00c83a496e0c5439bbf039f",
    "generic",
    "test/taste-corpus/r15-bedroom-off-living.arch",
  ],
  [
    "4ef6acc842062096c11718636008771c5ec6bd13e8613fff2017ccc1eed27d0c",
    "generic",
    "test/taste-corpus/r15-bedroom-off-living.good.arch",
  ],
  [
    "802bc32a8e5ee39b68652f532bf6113364c3feb8bc8c66d8225a5dbfa781a180",
    "generic",
    "test/taste-corpus/r16-door-mid-wall.arch",
  ],
  [
    "df5459196959ee9f5d627a46c87d6170685db77273c0ee01c6cd86f0018b086a",
    "generic",
    "test/taste-corpus/r16-door-mid-wall.good.arch",
  ],
  [
    "85bcf9b522b13ef88757b2d52fdcca23459633eafbcf76ae595d258a73447bd7",
    "generic",
    "test/taste-corpus/r17-staggered-partition.arch",
  ],
  [
    "846248e1788a0a9e3fa094c052983f3e0d826e28545bbb1a1e2cbf5c965f6be4",
    "generic",
    "test/taste-corpus/r17-staggered-partition.good.arch",
  ],
  [
    "997bf381da30ba356ffd17ba134b1f7a63b80d1f06aa4d796a3e785ff0077fda",
    "generic",
    "test/taste-corpus/r18-l-shaped-bedroom.arch",
  ],
  [
    "c65a3ca5ca2c266a36642afeab05da2618e653c49a853333c943f03c88207f58",
    "generic",
    "test/taste-corpus/r18-l-shaped-bedroom.good.arch",
  ],
  [
    "c3b3fa47104f080cfbcbf9b0c5a9d111fb9d6ac990be5e8af57de30302ec6d9c",
    "generic",
    "test/taste-corpus/r3-living-behind-corridor.arch",
  ],
  [
    "6a7d581bb7e4f0b7724cb3a86e00422c0de71b1134c47af88b2ebce142719e9a",
    "generic",
    "test/taste-corpus/r3-living-behind-corridor.good.arch",
  ],
  [
    "300d5bec23af3283e32b2fd7a522f115b6fae163336a2eba158fb58bec68b185",
    "generic",
    "test/taste-corpus/r6-bed-in-kitchen.arch",
  ],
  [
    "e1a96df83eb79f92c13d8eb22eabff5062d2dc924140a48e5b1159503c000b25",
    "generic",
    "test/taste-corpus/r6-bed-in-kitchen.good.arch",
  ],
  [
    "aa38d508c5de4ab03418aeceaee8481270f9bc96073e636f1ea8eff5d3d4571e",
    "generic",
    "test/taste-corpus/r7-small-window.arch",
  ],
  [
    "182424b6dc01615e30b64d0a4e7743ada6cdd2d77231e05b7dab60499b6f11a7",
    "generic",
    "test/taste-corpus/r7-small-window.good.arch",
  ],
  [
    "9d02a0dd680afab4abef3c570cffef0fb1020e1431af85dbcb5708baf16551e4",
    "generic",
    "test/taste-corpus/r9-long-bedroom.arch",
  ],
  [
    "04b39911fc21ec8216c20205b67eed78450bacce642b1b8f8f159358ebec1304",
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
