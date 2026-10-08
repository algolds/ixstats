/** @jest-environment node */
/**
 * IxStates Passport resolution: a stored `User.handle` resolves first, legacy names (forum, wiki,
 * Clerk id, cuid) still resolve, and a country name, slug or id no longer resolves a person.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    country: { findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    lorewardUserStats: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiRevision: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  lookupWikiUser: jest.fn().mockResolvedValue(null),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import {
  resolveCanonicalHandle,
  resolveIdentity,
} from "~/server/modules/identity/identity.resolve";

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  country: { findFirst: jest.Mock };
};

const kir = {
  id: "db_kir",
  clerkUserId: "clerk_kir",
  handle: "kir",
  forumUsername: "Kir Forum",
  forumUserId: 7,
  wikiUsername: null,
  role: null,
  country: null,
};

const caphiria = { id: "c_cap", name: "Caphiria", slug: "caphiria", owner: { ...kir, isActive: true } };

const noForum = { lookupUser: jest.fn().mockResolvedValue(null), getMember: jest.fn() };

/** `findUnique` answers only the stored-handle lookup; viewer lookups go through clerkUserId. */
function storedHandles(byHandle: Record<string, typeof kir>) {
  mocked.user.findUnique.mockImplementation((args: { where: { handle?: string } }) =>
    Promise.resolve(args.where.handle ? (byHandle[args.where.handle] ?? null) : null)
  );
}

beforeEach(() => {
  mocked.user.findUnique.mockReset();
  mocked.user.findFirst.mockReset().mockResolvedValue(null);
  mocked.country.findFirst.mockReset().mockResolvedValue(caphiria);
  noForum.lookupUser.mockClear();
  storedHandles({});
});

describe("resolveIdentity", () => {
  it("resolves a stored handle first, normalised, without the legacy name lookup", async () => {
    storedHandles({ kir });
    const identity = await resolveIdentity("@KIR", null);
    expect(identity?.user?.id).toBe("db_kir");
    expect(mocked.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: "kir" } })
    );
    expect(mocked.user.findFirst).not.toHaveBeenCalled();
  });

  it("still resolves a forum name when no stored handle matches", async () => {
    mocked.user.findFirst.mockResolvedValue(kir);
    const identity = await resolveIdentity("Kir Forum", null);
    expect(identity?.user?.id).toBe("db_kir");
    expect(identity?.handle).toBe("Kir Forum");
  });

  it("does not look up a stored handle for a segment that cannot be one", async () => {
    mocked.user.findFirst.mockResolvedValue(kir);
    await resolveIdentity("Kir Forum", null);
    expect(mocked.user.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ handle: expect.anything() }) })
    );
  });

  it("no longer resolves a country name, slug or id to a person", async () => {
    for (const segment of ["Caphiria", "caphiria", "c_cap"]) {
      const identity = await resolveIdentity(segment, null, noForum);
      expect(identity).toBeNull();
    }
    expect(mocked.country.findFirst).not.toHaveBeenCalled();
  });

  it("resolves me to the signed-in viewer", async () => {
    mocked.user.findFirst.mockResolvedValue(kir);
    const identity = await resolveIdentity("me", "clerk_kir");
    expect(identity?.user?.id).toBe("db_kir");
    expect(identity?.isOwner).toBe(true);
  });
});

describe("resolveCanonicalHandle", () => {
  it("returns the stored handle of the user a legacy name resolves to", async () => {
    mocked.user.findFirst.mockResolvedValue(kir);
    await expect(resolveCanonicalHandle("Kir Forum")).resolves.toEqual({ handle: "kir" });
  });

  it("returns the stored handle when the segment is the handle", async () => {
    storedHandles({ kir });
    await expect(resolveCanonicalHandle("@kir")).resolves.toEqual({ handle: "kir" });
  });

  it("selects only the handle, with no relation includes", async () => {
    storedHandles({ kir });
    await resolveCanonicalHandle("kir");
    mocked.user.findUnique.mockResolvedValue(null);
    mocked.user.findFirst.mockResolvedValue(kir);
    await resolveCanonicalHandle("Kir Forum");
    const calls = [...mocked.user.findUnique.mock.calls, ...mocked.user.findFirst.mock.calls];
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(args).toEqual(expect.objectContaining({ select: { handle: true } }));
      expect(args).not.toHaveProperty("include");
    }
  });

  it("is null for me, an unknown name, or a user without a stored handle", async () => {
    await expect(resolveCanonicalHandle("me")).resolves.toBeNull();
    await expect(resolveCanonicalHandle("nobody")).resolves.toBeNull();
    mocked.user.findFirst.mockResolvedValue({ ...kir, handle: null });
    await expect(resolveCanonicalHandle("Kir Forum")).resolves.toBeNull();
    expect(mocked.country.findFirst).not.toHaveBeenCalled();
  });
});
