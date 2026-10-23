/** @jest-environment node */
/**
 * Pat has a verified IxWiki account ("Ruler", also Pat's approved name claim), a Discord tag and a nation. Pat turns
 * wiki attribution and the Discord tag off, and hides the claim. A visitor, a member who blocked Pat, an admin and Pat
 * then read every surface that can name Pat: the passport, the player names other pages use, the member's block list
 * and the wiki author lookup. Only Pat still sees the wiki name, and nobody sees it tied to Pat's nation. With the
 * switches on and the claim shown, every surface names Pat by the wiki name again; when the switches cannot be read,
 * every surface that reads them hides it. The wiki author lookup reads the claim's visibility, never a switch.
 *
 * Folds privacy-settings-linked-names (the block-list labels, the one batch read).
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
  isDatabaseReadOnly: false,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserInfo: jest.fn().mockResolvedValue({ exists: true, user_editcount: 12, groups: [] }),
  getUserContribs: jest.fn().mockResolvedValue([]),
  getBacklinks: jest.fn().mockResolvedValue([]),
}));
// The passport's loaders that call MediaWiki, XenForo or Clerk, or read the Vault and the showcase
jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn().mockResolvedValue({ exists: true }),
  loadLoreStats: jest.fn().mockResolvedValue(null),
  loadLoreAwards: jest.fn().mockResolvedValue([]),
  loadLoreRank: jest.fn().mockResolvedValue(null),
  loadPersonalPersona: jest.fn().mockResolvedValue(null),
  loadClerkProfile: jest.fn().mockResolvedValue(null),
  loadWikiContribs: jest.fn().mockResolvedValue([]),
  loadNativeRevisions: jest.fn().mockResolvedValue([]),
  loadDiscussionComments: jest.fn().mockResolvedValue([]),
  loadAuthoredArticleRows: jest.fn().mockResolvedValue([]),
  loadConlangs: jest.fn().mockResolvedValue([]),
  loadCreatedPages: jest.fn().mockResolvedValue([]),
  loadDirectives: jest.fn().mockResolvedValue([]),
  loadSportTeams: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/modules/identity/identity.vault", () => ({
  resolvePassportVault: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/server/modules/identity/identity.showcase", () => ({
  ...jest.requireActual("~/server/modules/identity/identity.showcase"),
  loadAchievementsShowcase: jest.fn().mockResolvedValue(null),
}));

import type { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { getPassport } from "~/server/modules/identity/identity.service";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addCountry, addRealm } from "~/tests/helpers/money-world";
import { privacyConfigRow } from "~/tests/helpers/privacy-config-fake";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const WIKI_NAME = "Ruler";
const DISCORD = "ruler#7";
const forum = {
  getActivity: jest.fn().mockResolvedValue({ posts: 0, threads: 0 }),
  lookupUser: jest.fn(),
};

interface Person {
  id: string;
  clerkUserId: string;
}
const pat: Person = { id: "pat", clerkUserId: "user_pat" };
const mel: Person = { id: "mel", clerkUserId: "user_mel" };
const ada: Person = { id: "ada", clerkUserId: "user_ada" };
/** A player with no nation, so Mel's block list labels her by her wiki name or Discord tag when she shows them. */
const wren: Person = { id: "wren", clerkUserId: "user_wren" };

/** Pat holds Eldoria and the verified IxWiki account "Ruler"; Mel blocked Pat and Wren; Ada is an admin. */
async function seed(db: PrismaClient) {
  const { id: realmId } = await addRealm(db, "ixnay");
  const member = await db.role.create({
    data: { name: "member", displayName: "Member", level: 100 },
  });
  const admin = await db.role.create({ data: { name: "admin", displayName: "Admin", level: 10 } });
  await db.user.create({
    data: {
      ...pat,
      forumUsername: "Pathfinder",
      wikiUsername: WIKI_NAME,
      discordUsername: DISCORD,
      roleId: member.id,
      lastSeenAt: new Date(),
    },
  });
  await addCountry(db, "eldoria", realmId, pat.id);
  await db.user.update({ where: { id: pat.id }, data: { countryId: "eldoria" } });
  await db.wikiAccountLink.create({
    data: { userId: pat.id, source: "ixwiki", username: WIKI_NAME, verifiedAt: new Date() },
  });
  await db.wikiNameClaim.create({
    data: {
      id: "pat-claim",
      userId: pat.id,
      name: WIKI_NAME,
      status: "APPROVED",
      origin: "PLAYER",
      requestedById: pat.id,
      decidedAt: new Date(),
    },
  });
  await db.user.create({ data: { ...mel, lastSeenAt: new Date() } });
  await db.user.create({ data: { ...ada, roleId: admin.id, lastSeenAt: new Date() } });
  await db.user.create({
    data: {
      ...wren,
      wikiUsername: "Wren Writes",
      discordUsername: "wren#2",
      lastSeenAt: new Date(),
    },
  });
  for (const target of [pat, wren]) {
    await db.userConnection.create({
      data: { userId: mel.clerkUserId, targetUserId: target.id, connectionType: "blocked" },
    });
  }
}

/** Pat's and Wren's stored privacy switches, as Settings writes them; Pat's claim shows while wiki attribution is on. */
async function setSwitches(db: PrismaClient, config: Record<string, boolean>) {
  await db.wikiNameClaim.update({
    where: { id: "pat-claim" },
    data: { visible: config.showWikiAttribution !== false },
  });
  for (const person of [pat, wren]) {
    const row = privacyConfigRow(person.clerkUserId, config);
    await db.userConnection.upsert({
      where: {
        userId_targetUserId_connectionType: {
          userId: row.userId,
          targetUserId: row.targetUserId,
          connectionType: row.connectionType,
        },
      },
      create: row,
      update: { status: row.status },
    });
  }
}

/** The viewer's router context; null for a signed-out visitor. */
function asViewer(viewer: Person | null) {
  return createMockCallerContext({
    db: mockDb,
    auth: viewer ? { userId: viewer.clerkUserId } : null,
    user: viewer
      ? {
          id: viewer.id,
          clerkUserId: viewer.clerkUserId,
          countryId: viewer === pat ? "eldoria" : null,
        }
      : null,
    rateLimitIdentifier: `test:${Math.random()}`,
  });
}

/** Every surface that can name Pat, as `viewer` reads it. */
async function surfaces(viewer: Person | null) {
  const ctx = asViewer(viewer);
  const [passport, names, author] = await Promise.all([
    getPassport({ handle: "Pathfinder", viewerClerkId: viewer?.clerkUserId ?? null }, forum),
    loadPlayerNames([pat.id]),
    createCallerFactory(usersPreferencesRouter)(ctx).resolveWikiAuthor({ wikiUsername: WIKI_NAME }),
  ]);
  return { passport, name: names.get(pat.id), author };
}

/** Mel's block list's labels, as Settings → Privacy & Security shows them, sorted: the list has no set order. */
async function melsBlockList() {
  const settings = await createCallerFactory(usersPreferencesRouter)(
    asViewer(mel)
  ).getPrivacySettings();
  return settings.blockedAccounts.map((account) => account.label).sort();
}

const VISITORS = [
  ["a signed-out visitor", null],
  ["a member who blocked Pat", mel],
  ["an admin", ada],
] as const;

let db: MemoryPrisma;
beforeAll(async () => {
  for (const level of ["info", "log", "warn", "error"] as const)
    jest.spyOn(console, level).mockImplementation(() => {});
  mockDb = db = createMemoryPrisma();
  await seed(db as unknown as PrismaClient);
});

describe("with wiki attribution and the Discord tag off", () => {
  beforeAll(() =>
    setSwitches(db as unknown as PrismaClient, {
      showWikiAttribution: false,
      showDiscordTag: false,
    })
  );

  it.each(VISITORS)(
    "%s reads no wiki name, and no nation tied to it, on any surface",
    async (_who, viewer) => {
      const seen = await surfaces(viewer);
      const visitor = await surfaces(null);
      expect(JSON.stringify(seen.passport)).not.toContain(WIKI_NAME);
      expect(seen.passport).toMatchObject({
        handle: visitor.passport!.handle,
        wiki: { linked: false, username: null, lorewards: null },
      });
      expect(JSON.stringify(seen.name)).not.toMatch(/ruler/i);
      // A hidden claim's name is nobody's to the author lookup
      expect(seen.author).toBeNull();
    }
  );

  it("Pat still sees the wiki account on their own passport, under the same handle", async () => {
    const own = await surfaces(pat);
    const visitor = await surfaces(null);
    expect(own.passport).toMatchObject({
      handle: visitor.passport!.handle,
      wiki: { username: WIKI_NAME },
    });
    expect(own.passport!.handle).not.toMatch(/ruler/i);
    // Asked for by wiki name, even Pat's own lookup does not tie the hidden name to the nation
    expect(own.author).toBeNull();
  });

  it("labels Mel's blocked players by nation, else past the hidden wiki name and Discord tag, from one batch read", async () => {
    const reads = jest.spyOn(db.userConnection, "findMany");
    const users = jest.spyOn(db.user, "findMany");
    expect(await melsBlockList()).toEqual(["Nation eldoria", "User"]);
    // The listed users in one query, both switches of every listed user in one batch
    expect(users).toHaveBeenCalledTimes(1);
    const switchReads = reads.mock.calls.filter(
      ([args]) =>
        (args as { where: { connectionType?: string } }).where.connectionType === "privacy_config"
    );
    expect(switchReads).toHaveLength(1);
    reads.mockRestore();
    users.mockRestore();
  });
});

describe("with wiki attribution and the Discord tag on", () => {
  beforeAll(() =>
    setSwitches(db as unknown as PrismaClient, { showWikiAttribution: true, showDiscordTag: true })
  );

  it("names Pat by the wiki name on every surface, and ties it to Pat's nation and role", async () => {
    const seen = await surfaces(null);
    expect(seen.passport).toMatchObject({ wiki: { linked: true, username: WIKI_NAME } });
    expect(seen.name).toMatchObject({ handle: WIKI_NAME });
    expect(seen.author).toMatchObject({
      wikiUsername: WIKI_NAME,
      country: { id: "eldoria" },
      role: { name: "member", displayName: "Member" },
    });
    expect(JSON.stringify(seen.author)).not.toContain(pat.clerkUserId);
    expect(await melsBlockList()).toEqual(["Nation eldoria", "Wren Writes"]);
  });

  it("keeps the Discord tag in Mel's list for a player with the wiki switch off and the Discord switch on", async () => {
    await setSwitches(db as unknown as PrismaClient, {
      showWikiAttribution: false,
      showDiscordTag: true,
    });
    expect(await melsBlockList()).toEqual(["Nation eldoria", "wren#2"]);
  });
});

describe("when the switches cannot be read", () => {
  it.each(VISITORS)("%s reads no wiki name and no Discord tag", async (_who, viewer) => {
    await setSwitches(db as unknown as PrismaClient, {
      showWikiAttribution: true,
      showDiscordTag: true,
    });
    const findMany = db.userConnection.findMany.bind(db.userConnection);
    const reads = jest
      .spyOn(db.userConnection, "findMany")
      .mockImplementation(((args: { where: { connectionType?: string } }) =>
        args.where.connectionType === "privacy_config"
          ? Promise.reject(new Error("db down"))
          : findMany(args)) as never);
    try {
      const seen = await surfaces(viewer);
      expect(JSON.stringify(seen.passport)).not.toContain(WIKI_NAME);
      expect(JSON.stringify(seen.name)).not.toMatch(/ruler/i);
      if (viewer === mel) expect(await melsBlockList()).toEqual(["Nation eldoria", "User"]);
    } finally {
      reads.mockRestore();
    }
  });
});
