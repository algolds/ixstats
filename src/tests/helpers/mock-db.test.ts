/** @jest-environment node */
import { createMockPrisma } from "~/tests/helpers/mock-db";

it("hands a transaction the same auto-mocking client", async () => {
  const db = createMockPrisma();
  await db.$transaction((tx: typeof db) => tx.auditLog.create({ data: { action: "X" } }));
  expect(db.auditLog.create).toHaveBeenCalledWith({ data: { action: "X" } });
});
