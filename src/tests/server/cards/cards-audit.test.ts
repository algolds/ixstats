/** @jest-environment node */
/** The card admin's audit trail: one AuditLog row per admin action, which the Overview feed reads. */
import { adminActor } from "~/server/api/routers/cards/admin/_actor";
import {
  CARD_AUDIT_ACTIONS,
  CARD_FEED_ACTIONS,
  recordCardAudit,
} from "~/server/modules/cards/cards.audit";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("recordCardAudit", () => {
  it("writes one card row naming the admin, the target and what happened", async () => {
    const db = createMockPrisma();
    await recordCardAudit(db as never, {
      action: "CARD_GRANT",
      actor: "clerk_admin",
      target: "card_1",
      details: "Granted Elm #3",
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "clerk_admin",
        action: "CARD_GRANT",
        entityType: "CARD",
        target: "card_1",
        details: "Granted Elm #3",
        success: true,
      },
    });
  });

  it("stores no target when there is none, and caps the details at 1000 characters", async () => {
    const db = createMockPrisma();
    await recordCardAudit(db as never, {
      action: "CARD_IMPORT",
      actor: null,
      details: "x".repeat(1200),
    });
    const [[{ data }]] = db.auditLog.create.mock.calls as [
      [{ data: { target: string | null; details: string; userId: string | null } }],
    ];
    expect(data.target).toBeNull();
    expect(data.userId).toBeNull();
    expect(data.details).toHaveLength(1000);
  });

  it("feeds every action the trail writes, plus the four older card actions, once each", () => {
    expect(CARD_FEED_ACTIONS).toEqual(
      expect.arrayContaining([
        ...CARD_AUDIT_ACTIONS,
        "CARD_DESIGNER_MINT",
        "CARD_AUTHORS_BACKFILLED",
        "LORE_CARD_MINT",
        "LORE_CARDS_RECLASSIFIED",
      ])
    );
    expect(CARD_FEED_ACTIONS).toHaveLength(CARD_AUDIT_ACTIONS.length + 4);
    expect(new Set(CARD_FEED_ACTIONS).size).toBe(CARD_FEED_ACTIONS.length);
  });
});

describe("adminActor", () => {
  it("takes the DB id for the rows the admin changes and the Clerk id for the audit row", () => {
    expect(adminActor({ user: { id: "db_admin" }, auth: { userId: "clerk_admin" } })).toEqual({
      dbId: "db_admin",
      clerkId: "clerk_admin",
    });
  });
});
