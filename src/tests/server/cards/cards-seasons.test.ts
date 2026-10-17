/** @jest-environment node */
/** The interim card season number, until Phase 5's Season model. */
import { MAX_CARD_SEASON } from "~/lib/cards/season";
import { setCardSeason } from "~/server/modules/cards/cards.seasons";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };

it("stores the season and audits the change", async () => {
  const db = createMockPrisma();
  db.systemConfig.findUnique.mockResolvedValue({ value: "3" });
  await setCardSeason(db as never, actor, 4);
  expect(db.systemConfig.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { key: "currentIxCardSeason" },
      update: { value: "4" },
    })
  );
  expect(db.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "CARD_SEASON_SET",
      userId: "clerk_admin",
      details: "Card season 3 → 4",
    }),
  });
});

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

it("writes and audits nothing when the season is already the current one", async () => {
  const db = createMockPrisma();
  db.systemConfig.findUnique.mockResolvedValue({ value: "3" });
  await setCardSeason(db as never, actor, 3);
  expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
});

it("reads, writes and audits inside one transaction", async () => {
  const db = createMockPrisma();
  db.systemConfig.findUnique.mockResolvedValue({ value: "3" });
  await setCardSeason(db as never, actor, 4);
  expect(db.$transaction).toHaveBeenCalledTimes(1);
});
