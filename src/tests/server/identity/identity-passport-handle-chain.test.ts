/** @jest-environment node */
/**
 * Every handle the passport chain produces (`loadPassportHandle`: stored handle, verified wiki name
 * while wiki attribution is on, forum name, Clerk id) resolves back to the same user through the real
 * resolver, including when another user holds the computed name as their stored handle. With wiki
 * attribution off the chain never emits the wiki name, though old links carrying it still resolve.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    country: { findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
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
import { loadPassportHandle } from "~/server/modules/identity/identity.passport-handle";
import { escapeRegExp } from "~/lib/utils/escape-regexp";
import { resolveHandleUser, resolveIdentity } from "~/server/modules/identity/identity.resolve";

interface Row {
  id: string;
  clerkUserId: string;
  handle: string | null;
  forumUsername: string | null;
  forumUserId: number | null;
  wikiUsername: string | null;
}

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  userConnection: { findMany: jest.Mock };
};

type Clause = Record<string, string | { equals: string }>;

/** Postgres ILIKE, which Prisma's insensitive `equals` compiles to: `%` and `_` are wildcards, `\\` escapes. */
function ilike(value: string, pattern: string): boolean {
  const source = pattern.replace(
    /\\(.)|([%_])|([^\\%_]+)/gs,
    (_m, escaped: string, wild: string, text: string) =>
      escaped !== undefined
        ? escapeRegExp(escaped)
        : wild !== undefined
          ? wild === "%"
            ? ".*"
            : "."
          : escapeRegExp(text)
  );
  return new RegExp(`^${source}$`, "is").test(value);
}

/** One `legacyNameWhere` clause: an exact id, or a case-insensitive name. */
function matches(row: Row, clause: Clause): boolean {
  return Object.entries(clause).every(([field, test]) => {
    const value = row[field as keyof Row];
    if (typeof value !== "string") return false;
    return typeof test === "string" ? value === test : ilike(value, test.equals);
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
  mocked.wikiAccountLink.findFirst.mockResolvedValue(
    verifiedWikiName ? { username: verifiedWikiName } : null
  );
  const handle = await loadPassportHandle(user);
  const identity = await resolveIdentity(handle, null, noForum);
  return { handle, resolvedId: identity?.user?.id ?? null };
}

/** The user's stored privacy config (Settings → Privacy & Security). */
function privacyOf(user: Row, config: Record<string, boolean>) {
  mocked.userConnection.findMany.mockResolvedValue([
    { userId: user.clerkUserId, status: JSON.stringify(config) },
  ]);
}

beforeEach(() => {
  mocked.user.findUnique.mockReset();
  mocked.user.findFirst.mockReset();
  mocked.wikiAccountLink.findFirst.mockReset().mockResolvedValue(null);
  mocked.userConnection.findMany.mockReset().mockResolvedValue([]);
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

  it("treats % and _ in a name literally, so a wildcard names nobody", async () => {
    const helvianir = row("h", { forumUsername: "Helvianir" });
    const dax = row("c", { forumUsername: "Dax_" });
    usersTable([helvianir, dax]);

    for (const probe of ["%", "H%", "_elvianir", "Helviani_", "Da%"]) {
      expect(await resolveHandleUser(probe)).toBeNull();
    }
    expect((await resolveHandleUser("helvianir"))?.id).toBe("h");
    expect((await resolveHandleUser("Dax_"))?.id).toBe("c");
  });
});

describe("passport handle chain and wiki attribution", () => {
  const lyra = row("b", { wikiUsername: "Lyra Wiki", forumUsername: "LyraForum" });
  const bare = row("d", { wikiUsername: "Dee Wiki" });

  beforeEach(() => usersTable([lyra, bare]));

  it("uses the verified wiki name while wiki attribution is on", async () => {
    privacyOf(lyra, { showWikiAttribution: true });
    expect(await roundTrip(lyra, "Lyra Wiki")).toEqual({ handle: "Lyra Wiki", resolvedId: "b" });
  });

  it("skips the wiki name when wiki attribution is off, for the next name that resolves back", async () => {
    privacyOf(lyra, { showWikiAttribution: false });
    expect(await roundTrip(lyra, "Lyra Wiki")).toEqual({ handle: "LyraForum", resolvedId: "b" });

    privacyOf(bare, { showWikiAttribution: false });
    expect(await roundTrip(bare, "Dee Wiki")).toEqual({
      handle: bare.clerkUserId,
      resolvedId: "d",
    });
  });

  it("treats an unreadable switch as off", async () => {
    mocked.userConnection.findMany.mockRejectedValue(new Error("db down"));
    expect(await roundTrip(lyra, "Lyra Wiki")).toEqual({ handle: "LyraForum", resolvedId: "b" });
  });

  it("keeps a stored handle whatever the switch, without reading it", async () => {
    const kir = row("k", { handle: "kir", wikiUsername: "Kir Wiki" });
    usersTable([kir]);
    privacyOf(kir, { showWikiAttribution: false });
    expect(await roundTrip(kir, "Kir Wiki")).toEqual({ handle: "kir", resolvedId: "k" });
    expect(mocked.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("still resolves an old link that carries the wiki name", async () => {
    privacyOf(lyra, { showWikiAttribution: false });
    expect((await resolveIdentity("Lyra Wiki", null, noForum))?.user?.id).toBe("b");
    expect((await resolveHandleUser("lyra wiki"))?.id).toBe("b");
  });
});
