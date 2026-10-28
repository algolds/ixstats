/** @jest-environment node */
/**
 * Owner ruling 2026-10-28 (stress finding C-30): when the founder leaves, the founder role passes to the
 * longest-standing active member (earliest join), so someone can still invite; when the last member leaves, the
 * alliance dissolves. Before, the Stress Pact was left with one plain member and nobody able to invite.
 */
import { leaveAllianceMembership } from "~/lib/diplomacy/alliance-succession";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  db = createMemoryPrisma();
  await addIxnay(db as never);
  for (const id of ["a", "b", "c"]) {
    await addNation(db as never, { id, baselineDate: new Date(NOW - 365 * 86_400_000) });
  }
  await db.alliance.create({ data: { id: "pact", name: "Pact", memberCount: 3 } });
  const join = (countryId: string, role: string, daysAgo: number) =>
    db.allianceMember.create({
      data: {
        id: `m-${countryId}`,
        allianceId: "pact",
        countryId,
        role,
        joinedAt: new Date(NOW - daysAgo * 86_400_000),
      },
    });
  await join("a", "founder", 30);
  await join("c", "member", 10);
  await join("b", "member", 20);
});

it("passes the founder role to the earliest-joined member, then dissolves with the last one", async () => {
  const leave = (countryId: string) =>
    leaveAllianceMembership(db as never, { id: `m-${countryId}`, allianceId: "pact" });

  expect(await leave("a")).toEqual({ left: true, dissolved: false, newFounderCountryId: "b" });
  expect((await db.allianceMember.findUnique({ where: { id: "m-b" } }))?.role).toBe("founder");
  expect((await db.allianceMember.findUnique({ where: { id: "m-a" } }))?.role).toBe("member");
  expect((await db.alliance.findUnique({ where: { id: "pact" } }))?.memberCount).toBe(2);

  expect(await leave("c")).toEqual({ left: true, dissolved: false, newFounderCountryId: null });
  expect(await leave("c")).toMatchObject({ left: false });
  expect(await leave("b")).toEqual({ left: true, dissolved: true, newFounderCountryId: null });
  expect(await db.alliance.count()).toBe(0);
});
