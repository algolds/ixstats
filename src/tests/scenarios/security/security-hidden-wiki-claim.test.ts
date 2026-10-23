/** @jest-environment node */
/**
 * Pat's only old IxWiki name, "Ruler", is an approved claim Pat keeps hidden (as the conversion leaves the claims of a
 * player who had wiki attribution off). Pat has no stored handle, a forum name, a Discord tag and a nation. A visitor, a
 * member who blocked Pat, an admin and Pat then read every surface that can name Pat: the passport, `/@Ruler`, the
 * wiki author lookup, the player names other pages use and the name the mirror gives Pat's WikiOS edit. Only Pat still
 * sees the wiki name, on their own passport, and nobody sees it tied to Pat's nation. Once Pat shows the claim, every
 * surface names Pat by it. The claim's visibility decides this alone: there is no wiki attribution switch.
 *
 * Folds privacy-settings-linked-names: the block list labels a player by nation, handle, a Discord tag they show, else
 * "User", from one batch read of the Discord switch, and a switch that cannot be read hides every Discord tag.
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

import type { PrismaClient, WikiMirrorJob } from "@prisma/client";
import { planRevisionBatch } from "~/lib/wiki-os/services/mirror-revision";
import { createCallerFactory } from "~/server/api/trpc";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { resolveUserIdentity } from "~/server/modules/identity/identity.resolve";
import { getPassport } from "~/server/modules/identity/identity.service";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addCountry, addRealm } from "~/tests/helpers/money-world";
import { privacyConfigRow } from "~/tests/helpers/privacy-config-fake";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const WIKI_NAME = "Ruler";
const FORUM_NAME = "Pathfinder";
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
/** No nation, a stored handle. */
const wren: Person = { id: "wren", clerkUserId: "user_wren" };
/** No nation, no handle, a Discord tag. */
const quill: Person = { id: "quill", clerkUserId: "user_quill" };

/** Pat's WikiOS edit, waiting for the mirror, saved under Pat's passport handle. */
const MIRROR_JOB: WikiMirrorJob = {
  id: "job-1",
  source: "ixwiki",
  kind: "revision",
  title: "Eldoria",
  articleId: "art-1",
  revisionId: "rev-1",
  logId: null,
  payload: null,
  state: "running",
  attempts: 1,
  nextAttemptAt: new Date(),
  lastError: null,
  mwRevId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Pat holds Eldoria and the hidden claim "Ruler"; Mel blocked Pat, Wren and Quill; Ada is an admin. */
async function seed(db: PrismaClient) {
  const { id: realmId } = await addRealm(db, "ixnay");
  const member = await db.role.create({
    data: { name: "member", displayName: "Member", level: 100 },
  });
  const admin = await db.role.create({ data: { name: "admin", displayName: "Admin", level: 10 } });
  await db.user.create({
    data: {
      ...pat,
      forumUsername: FORUM_NAME,
      discordUsername: "ruler#7",
      roleId: member.id,
      lastSeenAt: new Date(),
    },
  });
  await addCountry(db, "eldoria", realmId, pat.id);
  await db.user.update({ where: { id: pat.id }, data: { countryId: "eldoria" } });
  await db.wikiNameClaim.create({
    data: {
      id: "pat-claim",
      userId: pat.id,
      name: WIKI_NAME,
      status: "APPROVED",
      visible: false,
      origin: "CONVERSION",
      requestedById: pat.id,
      decidedAt: new Date(),
    },
  });
  await db.user.create({ data: { ...mel, lastSeenAt: new Date() } });
  await db.user.create({ data: { ...ada, roleId: admin.id, lastSeenAt: new Date() } });
  await db.user.create({ data: { ...wren, handle: "wren", lastSeenAt: new Date() } });
  await db.user.create({
    data: { ...quill, discordUsername: "quill#3", lastSeenAt: new Date() },
  });
  for (const target of [pat, wren, quill]) {
    await db.userConnection.create({
      data: { userId: mel.clerkUserId, targetUserId: target.id, connectionType: "blocked" },
    });
  }
  await db.wikiArticle.create({ data: { id: "art-1", title: "Eldoria", wikitext: "Eldoria." } });
  await db.wikiRevision.create({
    data: {
      id: "rev-1",
      articleId: "art-1",
      wikitext: "Eldoria.",
      author: FORUM_NAME,
      authorId: pat.id,
      byteSize: 8,
    },
  });
}

/** Pat shows or hides the claim (Settings, IxnayID & Passport). */
const showClaim = (db: PrismaClient, visible: boolean) =>
  db.wikiNameClaim.update({ where: { id: "pat-claim" }, data: { visible } });

/** Quill's stored Discord switch, as Settings writes it. */
async function quillShowsDiscord(db: PrismaClient, shown: boolean) {
  const row = privacyConfigRow(quill.clerkUserId, { showDiscordTag: shown });
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

/** The contributor names the mirror would import Pat's edit under, as MediaWiki reads them. */
async function mirrorNames(): Promise<string[]> {
  const plan = await planRevisionBatch([MIRROR_JOB]);
  return [...(plan.xml ?? "").matchAll(/<username>([^<]*)<\/username>/g)].map((m) =>
    m[1]!.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&")
  );
}

/** Every surface that can name Pat, as `viewer` reads it. */
async function surfaces(viewer: Person | null) {
  const ctx = asViewer(viewer);
  const [passport, opened, author, names, mirror] = await Promise.all([
    getPassport({ handle: FORUM_NAME, viewerClerkId: viewer?.clerkUserId ?? null }, forum),
    resolveUserIdentity(`@${WIKI_NAME}`, viewer?.clerkUserId ?? null),
    createCallerFactory(usersPreferencesRouter)(ctx).resolveWikiAuthor({ wikiUsername: WIKI_NAME }),
    loadPlayerNames([pat.id]),
    mirrorNames(),
  ]);
  return { passport, opens: opened?.user?.id ?? null, author, name: names.get(pat.id), mirror };
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

describe("while Pat keeps the claim hidden", () => {
  beforeAll(() => showClaim(db as unknown as PrismaClient, false));

  it.each(VISITORS)(
    "%s reads no wiki name, and no nation tied to it, on any surface",
    async (_who, viewer) => {
      const seen = await surfaces(viewer);
      expect(JSON.stringify(seen.passport)).not.toContain(WIKI_NAME);
      expect(seen.passport).toMatchObject({
        handle: FORUM_NAME,
        wiki: { linked: false, username: null },
      });
      // `/@Ruler` does not open Pat's passport, and the author lookup gives the name to nobody
      expect(seen.opens).toBeNull();
      expect(seen.author).toBeNull();
      expect(seen.name).toEqual({ handle: FORUM_NAME, displayName: `@${FORUM_NAME}` });
      expect(seen.mirror).toEqual([`wikios>${FORUM_NAME}`]);
    }
  );

  it("Pat still sees the name on their own passport, under the same handle", async () => {
    const own = await surfaces(pat);
    expect(own.passport).toMatchObject({ handle: FORUM_NAME, wiki: { username: WIKI_NAME } });
    // Asked for by wiki name, even Pat's own lookup does not tie the hidden name to the nation
    expect(own.author).toBeNull();
    expect(own.name).toEqual({ handle: FORUM_NAME, displayName: `@${FORUM_NAME}` });
  });
});

describe("once Pat shows the claim", () => {
  beforeAll(() => showClaim(db as unknown as PrismaClient, true));

  it.each(VISITORS)(
    "%s reads Pat by the wiki name on every surface, tied to Pat's nation and role",
    async (_who, viewer) => {
      const seen = await surfaces(viewer);
      expect(seen.passport).toMatchObject({
        handle: WIKI_NAME,
        wiki: { linked: true, username: WIKI_NAME },
      });
      expect(seen.opens).toBe(pat.id);
      expect(seen.author).toMatchObject({
        wikiUsername: WIKI_NAME,
        country: { id: "eldoria" },
        role: { name: "member", displayName: "Member" },
      });
      expect(JSON.stringify(seen.author)).not.toContain(pat.clerkUserId);
      expect(seen.name).toEqual({ handle: WIKI_NAME, displayName: `@${WIKI_NAME}` });
      expect(seen.mirror).toEqual([WIKI_NAME]);
    }
  );
});

describe("Mel's block list", () => {
  it("labels each player by nation, handle, a Discord tag they show, else User, from one batch read", async () => {
    await quillShowsDiscord(db as unknown as PrismaClient, true);
    const reads = jest.spyOn(db.userConnection, "findMany");
    const users = jest.spyOn(db.user, "findMany");
    expect(await melsBlockList()).toEqual(["Nation eldoria", "quill#3", "wren"]);
    // The listed users in one query, the Discord switch of every listed user in one batch
    expect(users).toHaveBeenCalledTimes(1);
    const switchReads = reads.mock.calls.filter(
      ([args]) =>
        (args as { where: { connectionType?: string } }).where.connectionType === "privacy_config"
    );
    expect(switchReads).toHaveLength(1);
    reads.mockRestore();
    users.mockRestore();

    await quillShowsDiscord(db as unknown as PrismaClient, false);
    expect(await melsBlockList()).toEqual(["Nation eldoria", "User", "wren"]);
  });

  it("hides every Discord tag when the switch cannot be read", async () => {
    await quillShowsDiscord(db as unknown as PrismaClient, true);
    const findMany = db.userConnection.findMany.bind(db.userConnection);
    const reads = jest
      .spyOn(db.userConnection, "findMany")
      .mockImplementation(((args: { where: { connectionType?: string } }) =>
        args.where.connectionType === "privacy_config"
          ? Promise.reject(new Error("db down"))
          : findMany(args)) as never);
    try {
      expect(await melsBlockList()).toEqual(["Nation eldoria", "User", "wren"]);
    } finally {
      reads.mockRestore();
    }
  });
});
