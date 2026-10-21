/** @jest-environment node */
/** The interim card season number, until Phase 5's Season model. */
import { MAX_CARD_SEASON } from "~/lib/cards/season";
import { setCardSeason } from "~/server/modules/cards/cards.seasons";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
it("refuses a season out of range", async () => {
  const db = createMockPrisma();
  await expect(setCardSeason(db as never, actor, MAX_CARD_SEASON + 1)).rejects.toThrow(
    /between 1 and 100/
  );
  await expect(setCardSeason(db as never, actor, 0)).rejects.toThrow(/between 1 and 100/);
  await expect(setCardSeason(db as never, actor, 2.5)).rejects.toThrow(/between 1 and 100/);
  expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
});
