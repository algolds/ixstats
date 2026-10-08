/**
 * Settings "wiki connected" reflects only a VERIFIED ixwiki link. Owning a country (or holding an
 * unproven legacy User.wikiUsername) must not show as connected under the country's name.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn() },
    country: { findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiAccountLink: { findFirst: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const mocked = db as unknown as {
  user: { findUnique: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
};
const createCaller = createCallerFactory(ixnayidCoreRouter);

const ownerOfCountry = {
  id: "db_1",
  clerkUserId: "clerk_1",
  countryId: "c1",
  forumUserId: null,
  forumUsername: null,
  lastForumSync: null,
  discordUserId: null,
  discordUsername: null,
  lastDiscordSync: null,
  country: { id: "c1", name: "Kir Republic", slug: "kir-republic" },
};

function caller() {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "clerk_1" },
      user: { id: "db_1", clerkUserId: "clerk_1", role: { name: "user" } },
      db,
    }) as never
  );
}

describe("ixnayid.getStatus wiki state", () => {
  beforeEach(() => {
    mocked.user.findUnique.mockReset().mockResolvedValue(ownerOfCountry);
    mocked.wikiAccountLink.findFirst.mockReset();
  });

  it("is not linked for a country owner with no verified link", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
    const status = await caller().getStatus();
    expect(status.wiki.linked).toBe(false);
    expect(status.wiki.username).toBeNull();
    // and the passport handle never comes from an unverified wiki name, nor from the country
    // (a country name or slug no longer resolves a passport)
    expect(status.passportHandle).toBe("clerk_1");
  });

  it("queries only verified ixwiki links", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
    await caller().getStatus();
    expect(mocked.wikiAccountLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "db_1", source: "ixwiki", verifiedAt: { not: null } },
      })
    );
  });

  it("is linked, under the wiki username, once a link is verified", async () => {
    const verifiedAt = new Date("2026-09-01T00:00:00Z");
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir", verifiedAt });
    const status = await caller().getStatus();
    expect(status.wiki).toMatchObject({ linked: true, username: "Kir", lastSync: verifiedAt });
    expect(status.passportHandle).toBe("Kir");
  });
});
