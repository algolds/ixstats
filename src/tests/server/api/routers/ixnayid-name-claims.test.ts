/** @jest-environment node */
/**
 * `ixnayid` name claims: a player asks for an old IxWiki name, lists their own claims newest first and chooses which
 * show. The router acts as the signed-in player (never a system owner) and maps the module's refusals to tRPC codes.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: false }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidLinkingRouter } from "~/server/api/routers/ixnayid/linking";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";

let db: MemoryPrisma;
const createCaller = createCallerFactory(ixnayidLinkingRouter);
const callerAs = (id: string) =>
  createCaller(
    createMockRouterContext({
      auth: { userId: `clerk_${id}` },
      user: { id, clerkUserId: `clerk_${id}` },
      db,
    }) as never
  );

beforeEach(async () => {
  db = createMemoryPrisma();
  for (const id of ["p1", "p2"]) await db.user.create({ data: { id, clerkUserId: `clerk_${id}` } });
});

describe("requestNameClaim", () => {
  it("asks for the normalised name, pending", async () => {
    await expect(callerAs("p1").requestNameClaim({ name: "old_name" })).resolves.toMatchObject({
      name: "Old name",
      status: "PENDING",
      userId: "p1",
    });
  });

  it("refuses a second identical request with the module's message", async () => {
    await callerAs("p1").requestNameClaim({ name: "old_name" });
    await expect(callerAs("p1").requestNameClaim({ name: "Old name" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You already hold or asked for this name.",
    });
  });
});

describe("setNameClaimVisibility", () => {
  it("hides the caller's own claim", async () => {
    const claim = await callerAs("p1").requestNameClaim({ name: "Old name" });
    await expect(
      callerAs("p1").setNameClaimVisibility({ claimId: claim.id, visible: false })
    ).resolves.toMatchObject({ id: claim.id, visible: false });
  });

  it("does not find another user's claim", async () => {
    const claim = await callerAs("p2").requestNameClaim({ name: "Old name" });
    await expect(
      callerAs("p1").setNameClaimVisibility({ claimId: claim.id, visible: false })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "No such name claim." });
  });
});

describe("listMyNameClaims", () => {
  it("lists only the caller's claims, newest first", async () => {
    const claim = (id: string, userId: string, name: string, createdAt: string) =>
      db.wikiNameClaim.create({
        data: {
          id,
          userId,
          source: "ixwiki",
          name,
          status: "PENDING",
          origin: "PLAYER",
          requestedById: userId,
          createdAt: new Date(createdAt),
        },
      });
    await claim("c1", "p1", "Older", "2026-10-01T00:00:00Z");
    await claim("c2", "p2", "Theirs", "2026-10-02T00:00:00Z");
    await claim("c3", "p1", "Newer", "2026-10-03T00:00:00Z");
    const mine = await callerAs("p1").listMyNameClaims();
    expect(mine.map((c) => c.id)).toEqual(["c3", "c1"]);
  });
});
