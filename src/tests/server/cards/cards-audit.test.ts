/** @jest-environment node */
/** The card admin's audit trail: one AuditLog row per admin action, which the Overview feed reads. */
import { recordCardAudit } from "~/server/modules/cards/cards.audit";
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
});
