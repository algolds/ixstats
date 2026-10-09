/** @jest-environment node */
/**
 * Every handle the passport chain produces (`passportHandleOf`: stored handle, verified wiki name,
 * forum name, Clerk id) resolves back to the same user through the real resolver, including when
 * another user holds the computed name as their stored handle.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    country: { findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
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
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";
import { passportHandleOf } from "~/server/modules/identity/identity.passport-handle";

interface Row {
  id: string;
  clerkUserId: string;
  handle: string | null;
  forumUsername: string | null;
  forumUserId: number | null;
  wikiUsername: string | null;
}

const mocked = db as unknown as { user: { findUnique: jest.Mock; findFirst: jest.Mock } };

type Clause = Record<string, string | { equals: string }>;

/** One `legacyNameWhere` clause: an exact id, or a case-insensitive name. */
function matches(row: Row, clause: Clause): boolean {
  return Object.entries(clause).every(([field, test]) => {
    const value = row[field as keyof Row];
    if (typeof value !== "string") return false;
    return typeof test === "string" ? value === test : value.toLowerCase() === test.equals.toLowerCase();
  });
}

/** A tiny user table behind the two lookups the resolver makes. */
function usersTable(rows: Row[]) {
  mocked.user.findUnique.mockImplementation(({ where }: { where: Clause }) =>
    Promise.resolve(rows.find((row) => matches(row, where)) ?? null)
  );
  mocked.user.findFirst.mockImplementation(({ where }: { where: { OR: Clause[] } }) =>
    Promise.resolve(rows.find((row) => where.OR.some((clause) => matches(row, clause))) ?? null)
  );
}

const row = (id: string, fields: Partial<Row>): Row => ({
  id,
  clerkUserId: `user_${id}_${"x".repeat(24)}`,
  handle: null,
  forumUsername: null,
  forumUserId: null,
  wikiUsername: null,
  ...fields,
});

const noForum = { lookupUser: jest.fn().mockResolvedValue(null), getActivity: jest.fn() };

async function roundTrip(user: Row, verifiedWikiName: string | null) {
  const handle = await passportHandleOf(user, verifiedWikiName);
  const identity = await resolveIdentity(handle, null, noForum);
  return { handle, resolvedId: identity?.user?.id ?? null };
}

beforeEach(() => {
  mocked.user.findUnique.mockReset();
  mocked.user.findFirst.mockReset();
});

describe("passport handle chain round trip", () => {
  it("resolves a stored handle, a verified wiki name, a forum name and a Clerk id to their user", async () => {
    const stored = row("a", { handle: "kir" });
    // Verifying an ixwiki link writes the legacy `User.wikiUsername` the resolver reads.
    const wiki = row("b", { wikiUsername: "Lyra Wiki", forumUsername: "LyraForum" });
    const forum = row("c", { forumUsername: "Dax_" });
    const bare = row("d", {});
    usersTable([stored, wiki, forum, bare]);

    expect(await roundTrip(stored, null)).toEqual({ handle: "kir", resolvedId: "a" });
    expect(await roundTrip(wiki, "Lyra Wiki")).toEqual({ handle: "Lyra Wiki", resolvedId: "b" });
    expect(await roundTrip(forum, null)).toEqual({ handle: "Dax_", resolvedId: "c" });
    expect(await roundTrip(bare, null)).toEqual({ handle: bare.clerkUserId, resolvedId: "d" });
  });

  it("skips a computed name another user holds as a handle or a name", async () => {
    const holder = row("owner", { handle: "bob" });
    const namesake = row("namesake", { wikiUsername: "Zed", forumUsername: "Bob" });
    const zed = row("zed", { forumUsername: "Zed" });
    usersTable([holder, zed, namesake]);

    const forumClash = await roundTrip(namesake, null);
    expect(forumClash).toEqual({ handle: namesake.clerkUserId, resolvedId: "namesake" });
    const wikiClash = await roundTrip(namesake, "Zed");
    expect(wikiClash.resolvedId).toBe("namesake");
  });
});
