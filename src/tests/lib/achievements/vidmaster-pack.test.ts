/** @jest-environment node */
/** Cards refresh §3: the Vidmaster achievements reward a pack that exists. */
import packs from "../../../../prisma/seeds/data/card-packs.json";
import { VIDMASTER_REWARD_PACK_ID } from "~/lib/achievements/sync";

it("rewards a seeded pack", () => {
  expect(packs.map((pack) => pack.id)).toContain(VIDMASTER_REWARD_PACK_ID);
});
