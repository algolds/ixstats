/** @jest-environment node */
/**
 * Native lore's server rules (docs/superpowers/specs/2026-10-24-native-lore-design.md): who may write a country's
 * lore (its owner and the lore team, only in the default realm and while WikiOS editing is on), which pieces its
 * Lore tab lists (the lore category's pages and the owner's added titles, without hidden or missing pages, pinned
 * first), and the owner's lore team and curation, every write re-checked on the server.
 */
interface FakeCountry {
  id: string;
  name: string;
  realmId: string;
  ownerUserId: string | null;
}
interface FakeAuthor {
  countryId: string;
  userId: string;
  addedById: string;
  createdAt: Date;
}
interface FakePage {
  countryId: string;
  title: string;
  type: string;
  pinned: boolean;
  hidden: boolean;
  /** Added by the owner (`addExistingPiece`): listed even without the lore category. */
  ownerAdded: boolean;
  addedById: string;
}
type Defaulted = "pinned" | "hidden" | "ownerAdded";
/** A page row as written: the database defaults `pinned`, `hidden` and `ownerAdded` to false. */
type NewPage = Omit<FakePage, Defaulted> & Partial<Pick<FakePage, Defaulted>>;
interface FakeStore {
  countries: Map<string, FakeCountry>;
  authors: FakeAuthor[];
  pages: FakePage[];
}
interface PairKey {
  countryId: string;
  userId: string;
}
interface TitleKey {
  countryId: string;
  title: string;
}

jest.mock("~/server/db", () => {
  const { Prisma } = jest.requireActual<typeof import("@prisma/client")>("@prisma/client");
  const store: FakeStore = { countries: new Map(), authors: [], pages: [] };
  const sameAuthor = (a: FakeAuthor, key: PairKey) =>
    a.countryId === key.countryId && a.userId === key.userId;
  const samePage = (p: FakePage, key: TitleKey) =>
    p.countryId === key.countryId && p.title === key.title;
  const findPage = (key: TitleKey) => store.pages.find((p) => samePage(p, key)) ?? null;
  /** Prisma leaves a field passed as undefined unchanged. */
  const assignDefined = (row: FakePage, changes: Partial<FakePage>) =>
    Object.assign(
      row,
      Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
    );
  const db = {
    country: {
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return store.countries.get(args.where.id) ?? null;
      }),
    },
    countryLoreAuthor: {
      findUnique: jest.fn(async (args: { where: { countryId_userId: PairKey } }) => {
        return store.authors.find((a) => sameAuthor(a, args.where.countryId_userId)) ?? null;
      }),
      findMany: jest.fn(async (args: { where: { countryId: string } }) => {
        return store.authors.filter((a) => a.countryId === args.where.countryId);
      }),
      create: jest.fn(async (args: { data: Omit<FakeAuthor, "createdAt"> }) => {
        if (store.authors.some((a) => sameAuthor(a, args.data))) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        const row = { ...args.data, createdAt: new Date() };
        store.authors.push(row);
        return row;
      }),
      deleteMany: jest.fn(async (args: { where: PairKey }) => {
        const before = store.authors.length;
        store.authors = store.authors.filter((a) => !sameAuthor(a, args.where));
        return { count: before - store.authors.length };
      }),
    },
    countryLorePage: {
      findMany: jest.fn(async (args: { where: { countryId: string } }) => {
        return store.pages.filter((p) => p.countryId === args.where.countryId);
      }),
      findUnique: jest.fn(async (args: { where: { countryId_title: TitleKey } }) => {
        return findPage(args.where.countryId_title);
      }),
      create: jest.fn(async (args: { data: NewPage }) => {
        const row = { pinned: false, hidden: false, ownerAdded: false, ...args.data };
        store.pages.push(row);
        return row;
      }),
      update: jest.fn(
        async (args: { where: { countryId_title: TitleKey }; data: Partial<FakePage> }) => {
          const row = findPage(args.where.countryId_title);
          if (!row) throw new Error("no row to update");
          return assignDefined(row, args.data);
        }
      ),
      upsert: jest.fn(
        async (args: {
          where: { countryId_title: TitleKey };
          create: NewPage;
          update: Partial<FakePage>;
        }) => {
          const row = findPage(args.where.countryId_title);
          if (row) return assignDefined(row, args.update);
          const created = { pinned: false, hidden: false, ownerAdded: false, ...args.create };
          store.pages.push(created);
          return created;
        }
      ),
    },
  };
  return { __esModule: true, db, store };
});

jest.mock("~/server/shared/country-authorization", () => ({
  hasCountryWriteAccess: jest.fn(),
}));
jest.mock("~/lib/wiki-os/editing-switch", () => ({
  refreshWikiosEditingFlag: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/category-members", () => ({
  loadCategoryMembers: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/visible-page", () => ({
  readVisiblePage: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  resolveRedirect: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { resolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { refreshWikiosEditingFlag } from "~/lib/wiki-os/editing-switch";
import { loadCategoryMembers } from "~/lib/wiki-os/services/category-members";
import { readVisiblePage } from "~/lib/wiki-os/services/visible-page";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  addExistingPiece,
  addLoreAuthor,
  getLoreAccess,
  listLorePieces,
  listLoreTeam,
  recordPiece,
  removeLoreAuthor,
  setCuration,
  type LoreIdentity,
} from "~/server/modules/lore/lore.service";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const { store } = jest.requireMock<{ store: FakeStore }>("~/server/db");

const COUNTRY = "caphiria";
const OTHER_REALM_COUNTRY = "elsewhere";
const OWNER = "owner_1";
const COAUTHOR = "coauthor_1";
const STRANGER = "stranger_1";

const as = (userId: string) =>
  createMockRouterContext({
    auth: { userId: `clerk_${userId}` },
    user: { id: userId, clerkUserId: `clerk_${userId}`, countryId: null },
  });
const signedOut = () => createMockRouterContext({ auth: null, user: null });

/** The wiki: title → the page it leads to (after redirects) and its wikitext. */
const wiki = new Map<string, { resolvedTitle: string; wikitext: string }>();
const onWiki = (title: string, wikitext: string, resolvedTitle = title) =>
  wiki.set(title, { resolvedTitle, wikitext });

const categoryPages = (...titles: string[]) =>
  jest.mocked(loadCategoryMembers).mockResolvedValue({
    members: titles.map((title) => ({
      pageid: 0,
      title,
      type: "page" as const,
      ns: 0,
      isSubcategory: false,
      imageUrl: null,
    })),
    hasMore: false,
  });

const identity: LoreIdentity = {
  userOfHandle: async (handle) =>
    ({ livia: COAUTHOR, stranger: STRANGER, owner: OWNER })[handle] ?? null,
  namesOf: async (ids) =>
    new Map(ids.map((id) => [id, { handle: `h_${id}`, displayName: `@h_${id}` }])),
};

async function refusal(work: Promise<object | void>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    if (error instanceof TRPCError) return error.code;
    throw error;
  }
  return undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  store.countries = new Map([
    [COUNTRY, { id: COUNTRY, name: "Caphiria", realmId: "default", ownerUserId: OWNER }],
    [
      OTHER_REALM_COUNTRY,
      { id: OTHER_REALM_COUNTRY, name: "Elsewhere", realmId: "realm_b", ownerUserId: OWNER },
    ],
  ]);
  store.authors = [];
  store.pages = [];
  wiki.clear();
  jest.mocked(refreshWikiosEditingFlag).mockResolvedValue(true);
  jest.mocked(hasCountryWriteAccess).mockImplementation(async (ctx) => ctx.user?.id === OWNER);
  jest.mocked(readVisiblePage).mockImplementation(async (_ctx, title) => {
    const page = wiki.get(title);
    return { resolvedTitle: page?.resolvedTitle ?? title, wikitext: page?.wikitext ?? null };
  });
  jest.mocked(resolveRedirect).mockImplementation(async (title) => ({
    title: wiki.get(title)?.resolvedTitle ?? title,
    fragment: null,
  }));
  categoryPages();
});

describe("getLoreAccess", () => {
  it("lets the owner write in the default realm while editing is on", async () => {
    expect(await getLoreAccess(as(OWNER), COUNTRY)).toEqual({
      enabled: true,
      isOwner: true,
      canWrite: true,
    });
  });

  it("lets a lore team member write without owning the country", async () => {
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });
    expect(await getLoreAccess(as(COAUTHOR), COUNTRY)).toEqual({
      enabled: true,
      isOwner: false,
      canWrite: true,
    });
  });

  it("gives a stranger and a signed-out visitor nothing to write with", async () => {
    const none = { enabled: true, isOwner: false, canWrite: false };
    expect(await getLoreAccess(as(STRANGER), COUNTRY)).toEqual(none);
    expect(await getLoreAccess(signedOut(), COUNTRY)).toEqual(none);
  });

  it("is off for a country outside the default realm, even for its owner", async () => {
    expect(await getLoreAccess(as(OWNER), OTHER_REALM_COUNTRY)).toEqual({
      enabled: false,
      isOwner: false,
      canWrite: false,
    });
  });

  it("is off while WikiOS editing is off", async () => {
    jest.mocked(refreshWikiosEditingFlag).mockResolvedValue(false);
    expect(await getLoreAccess(as(OWNER), COUNTRY)).toEqual({
      enabled: false,
      isOwner: false,
      canWrite: false,
    });
  });

  it("is off for a country that does not exist", async () => {
    expect(await getLoreAccess(as(OWNER), "nowhere")).toEqual({
      enabled: false,
      isOwner: false,
      canWrite: false,
    });
  });
});

describe("listLorePieces", () => {
  it("merges the lore category with the owner's titles, without hidden or missing pages, pinned first", async () => {
    categoryPages("Venceia", "Senate of Caphiria", "Deleted Piece", "Hidden Piece");
    onWiki("Venceia", "{{Infobox settlement|name=Venceia}}");
    onWiki("Senate of Caphiria", "{{Infobox organization}}");
    onWiki("Hidden Piece", "{{Infobox person}}");
    onWiki("Constantinus I", "{{Infobox settlement}}"); // the curated type wins over the infobox
    onWiki("Aurelian Wars", "{{Infobox military conflict}}");
    store.pages.push(
      {
        countryId: COUNTRY,
        title: "Constantinus I",
        type: "person",
        pinned: false,
        hidden: false,
        ownerAdded: true,
        addedById: OWNER,
      },
      {
        countryId: COUNTRY,
        title: "Aurelian Wars",
        type: "event",
        pinned: true,
        hidden: false,
        ownerAdded: true,
        addedById: OWNER,
      },
      {
        countryId: COUNTRY,
        title: "Hidden Piece",
        type: "person",
        pinned: false,
        hidden: true,
        ownerAdded: false,
        addedById: OWNER,
      },
      {
        countryId: COUNTRY,
        title: "Gone Page",
        type: "place",
        pinned: true,
        hidden: false,
        ownerAdded: true,
        addedById: OWNER,
      }
    );

    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([
      { title: "Aurelian Wars", type: "event", pinned: true },
      { title: "Constantinus I", type: "person", pinned: false },
      { title: "Senate of Caphiria", type: "organisation", pinned: false },
      { title: "Venceia", type: "place", pinned: false },
    ]);
    expect(loadCategoryMembers).toHaveBeenCalledWith({
      category: "Caphiria lore",
      limit: 500,
      type: "page",
    });
  });

  it("lists a renamed page once, under its new title, keeping the owner's pin", async () => {
    categoryPages("New Name");
    onWiki("Old Name", "{{Infobox person}}", "New Name");
    onWiki("New Name", "{{Infobox person}}");
    store.pages.push({
      countryId: COUNTRY,
      title: "Old Name",
      type: "person",
      pinned: true,
      hidden: false,
      ownerAdded: false,
      addedById: OWNER,
    });

    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([
      { title: "New Name", type: "person", pinned: true },
    ]);
  });

  it("keeps a hidden piece hidden after its page is renamed", async () => {
    categoryPages("New Name");
    onWiki("Old Name", "{{Infobox person}}", "New Name");
    onWiki("New Name", "{{Infobox person}}\n[[Category:Caphiria lore]]");
    store.pages.push({
      countryId: COUNTRY,
      title: "Old Name",
      type: "person",
      pinned: false,
      hidden: true,
      ownerAdded: false,
      addedById: OWNER,
    });

    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([]);
    expect(readVisiblePage).not.toHaveBeenCalledWith(expect.anything(), "Old Name");
  });

  const coauthorOnTeam = () =>
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });

  it("drops a recorded piece once its page leaves the lore category", async () => {
    coauthorOnTeam();
    categoryPages("Venceia");
    onWiki("Venceia", "{{Infobox settlement}}\n[[Category:Caphiria lore]]");
    await recordPiece(as(COAUTHOR), COUNTRY, { title: "Venceia", type: "place" });
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([
      { title: "Venceia", type: "place", pinned: false },
    ]);

    // The category line is reverted: the page is no longer a category member.
    categoryPages();
    onWiki("Venceia", "{{Infobox settlement}}");
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([]);
  });

  it("drops a recorded piece the owner pinned once its page leaves the category", async () => {
    store.pages.push({
      countryId: COUNTRY,
      title: "Venceia",
      type: "place",
      pinned: true,
      hidden: false,
      ownerAdded: false,
      addedById: COAUTHOR,
    });
    onWiki("Venceia", "{{Infobox settlement}}");
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([]);
  });

  it("keeps a page the owner added listed without the category, even after a co-author records it", async () => {
    coauthorOnTeam();
    onWiki("Constantinus I", "{{Infobox person}}");
    await addExistingPiece(as(OWNER), COUNTRY, { title: "Constantinus I", type: "person" });
    expect(store.pages).toEqual([expect.objectContaining({ ownerAdded: true })]);
    onWiki("Constantinus I", "{{Infobox person}}\n[[Category:Caphiria lore]]");
    await recordPiece(as(COAUTHOR), COUNTRY, { title: "Constantinus I", type: "person" });
    onWiki("Constantinus I", "{{Infobox person}}");

    expect(store.pages).toEqual([expect.objectContaining({ ownerAdded: true })]);
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([
      { title: "Constantinus I", type: "person", pinned: false },
    ]);
  });

  it("marks a recorded piece as the owner's once the owner adds it", async () => {
    coauthorOnTeam();
    onWiki("Venceia", "{{Infobox settlement}}\n[[Category:Caphiria lore]]");
    await recordPiece(as(COAUTHOR), COUNTRY, { title: "Venceia", type: "place" });
    expect(store.pages).toEqual([expect.objectContaining({ ownerAdded: false })]);
    await addExistingPiece(as(OWNER), COUNTRY, { title: "Venceia", type: "place" });
    onWiki("Venceia", "{{Infobox settlement}}");
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([
      { title: "Venceia", type: "place", pinned: false },
    ]);
  });

  it("lists the page a redirect in the category leads to, though the page itself is not in it", async () => {
    categoryPages("Venceia (old)");
    // A read follows the redirect: it answers the page it leads to.
    onWiki("Venceia (old)", "{{Infobox settlement}}", "Venceia");
    onWiki("Venceia", "{{Infobox settlement}}");
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([
      { title: "Venceia", type: "place", pinned: false },
    ]);
  });

  it("keeps a hidden page the owner added hidden", async () => {
    onWiki("Constantinus I", "{{Infobox person}}");
    store.pages.push({
      countryId: COUNTRY,
      title: "Constantinus I",
      type: "person",
      pinned: false,
      hidden: true,
      ownerAdded: true,
      addedById: OWNER,
    });
    expect(await listLorePieces(signedOut(), COUNTRY)).toEqual([]);
  });

  it("reads at most eight pages at once, and still lists every one", async () => {
    const titles = Array.from({ length: 30 }, (_, i) => `Piece ${String(i).padStart(2, "0")}`);
    categoryPages(...titles);
    for (const title of titles) onWiki(title, "{{Infobox person}}");
    let inFlight = 0;
    let most = 0;
    jest.mocked(readVisiblePage).mockImplementation(async (_ctx, title) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { resolvedTitle: title, wikitext: wiki.get(title)?.wikitext ?? null };
    });

    const pieces = await listLorePieces(signedOut(), COUNTRY);
    expect(pieces).toHaveLength(30);
    expect(most).toBe(8);
  });

  it("never lists a deleted page, even to a reader who may see deleted pages", async () => {
    categoryPages("Venceia");
    onWiki("Venceia", "{{Infobox settlement}}");
    await listLorePieces(as(OWNER), COUNTRY);
    expect(readVisiblePage).toHaveBeenCalledWith(expect.anything(), "Venceia", {
      includeArchived: false,
    });
  });

  it("lists nothing for a country outside the default realm", async () => {
    categoryPages("Venceia");
    onWiki("Venceia", "{{Infobox settlement}}");
    expect(await listLorePieces(signedOut(), OTHER_REALM_COUNTRY)).toEqual([]);
    expect(loadCategoryMembers).not.toHaveBeenCalled();
  });
});

describe("the lore team", () => {
  it("lets the owner add a co-author by handle, who can then write", async () => {
    await addLoreAuthor(as(OWNER), COUNTRY, "livia", identity);
    expect(store.authors).toEqual([
      expect.objectContaining({ countryId: COUNTRY, userId: COAUTHOR, addedById: OWNER }),
    ]);
    expect((await getLoreAccess(as(COAUTHOR), COUNTRY)).canWrite).toBe(true);
  });

  it("refuses a non-owner, even a co-author, and adds nobody", async () => {
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });
    expect(await refusal(addLoreAuthor(as(COAUTHOR), COUNTRY, "stranger", identity))).toBe(
      "FORBIDDEN"
    );
    expect(await refusal(addLoreAuthor(as(STRANGER), COUNTRY, "stranger", identity))).toBe(
      "FORBIDDEN"
    );
    expect(await refusal(addLoreAuthor(signedOut(), COUNTRY, "stranger", identity))).toBe(
      "FORBIDDEN"
    );
    expect(store.authors).toHaveLength(1);
  });

  it("refuses an unknown handle, the owner themself and someone already on the team", async () => {
    expect(await refusal(addLoreAuthor(as(OWNER), COUNTRY, "nobody", identity))).toBe("NOT_FOUND");
    expect(await refusal(addLoreAuthor(as(OWNER), COUNTRY, "owner", identity))).toBe("BAD_REQUEST");
    await addLoreAuthor(as(OWNER), COUNTRY, "livia", identity);
    expect(await refusal(addLoreAuthor(as(OWNER), COUNTRY, "livia", identity))).toBe("CONFLICT");
    expect(store.authors).toHaveLength(1);
  });

  it("refuses team changes outside the default realm and while editing is off", async () => {
    expect(await refusal(addLoreAuthor(as(OWNER), OTHER_REALM_COUNTRY, "livia", identity))).toBe(
      "FORBIDDEN"
    );
    jest.mocked(refreshWikiosEditingFlag).mockResolvedValue(false);
    expect(await refusal(addLoreAuthor(as(OWNER), COUNTRY, "livia", identity))).toBe("FORBIDDEN");
    expect(store.authors).toHaveLength(0);
  });

  it("takes writing away from a removed co-author on their next request", async () => {
    await addLoreAuthor(as(OWNER), COUNTRY, "livia", identity);
    expect(await removeLoreAuthor(as(OWNER), COUNTRY, COAUTHOR)).toEqual({ removed: true });

    expect((await getLoreAccess(as(COAUTHOR), COUNTRY)).canWrite).toBe(false);
    expect(
      await refusal(recordPiece(as(COAUTHOR), COUNTRY, { title: "Venceia", type: "place" }))
    ).toBe("FORBIDDEN");
  });

  it("lets only the owner remove a co-author", async () => {
    await addLoreAuthor(as(OWNER), COUNTRY, "livia", identity);
    expect(await refusal(removeLoreAuthor(as(COAUTHOR), COUNTRY, COAUTHOR))).toBe("FORBIDDEN");
    expect(store.authors).toHaveLength(1);
  });

  it("names the team for the owner only", async () => {
    await addLoreAuthor(as(OWNER), COUNTRY, "livia", identity);
    expect(await listLoreTeam(as(OWNER), COUNTRY, identity)).toEqual([
      { userId: COAUTHOR, handle: `h_${COAUTHOR}`, displayName: `@h_${COAUTHOR}` },
    ]);
    expect(await refusal(listLoreTeam(as(COAUTHOR), COUNTRY, identity))).toBe("FORBIDDEN");
  });
});

describe("curation", () => {
  const coauthorOnTeam2 = () =>
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });

  it("records a piece a co-author wrote, under its canonical title", async () => {
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });
    onWiki("Venceia old town", "{{Infobox settlement}}\n[[Category:caphiria_lore|Old town]]");
    await recordPiece(as(COAUTHOR), COUNTRY, { title: "venceia_old_town", type: "place" });
    expect(store.pages).toEqual([
      expect.objectContaining({ title: "Venceia old town", type: "place", addedById: COAUTHOR }),
    ]);
  });

  it("refuses to record a page that is not in the country's lore category, or does not exist", async () => {
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });
    onWiki("Main Page", "Welcome\n[[Category:Caphiria]]\n[[:Category:Caphiria lore]]");
    await expect(
      recordPiece(as(COAUTHOR), COUNTRY, { title: "Main Page", type: "other" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This page is not in Caphiria lore yet.",
    });
    expect(
      await refusal(recordPiece(as(COAUTHOR), COUNTRY, { title: "Nowhere", type: "place" }))
    ).toBe("NOT_FOUND");
    expect(store.pages).toHaveLength(0);
  });

  it("records a renamed piece under the title it leads to", async () => {
    onWiki("Venceia", "[[Category:Caphiria lore]]", "Venceia (city)");
    expect(await recordPiece(as(OWNER), COUNTRY, { title: "Venceia", type: "place" })).toEqual({
      title: "Venceia (city)",
    });
    expect(store.pages).toEqual([expect.objectContaining({ title: "Venceia (city)" })]);
  });

  it("never un-hides a piece the owner hid when a co-author records it again", async () => {
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });
    store.pages.push({
      countryId: COUNTRY,
      title: "Venceia",
      type: "other",
      pinned: false,
      hidden: true,
      ownerAdded: false,
      addedById: OWNER,
    });
    onWiki("Venceia", "{{Infobox settlement}}\n[[Category:Caphiria lore]]");
    await recordPiece(as(COAUTHOR), COUNTRY, { title: "Venceia", type: "place" });
    expect(store.pages).toEqual([
      // Nor retypes it: the owner's type stands (see "never retype one that has a record").
      expect.objectContaining({ title: "Venceia", type: "other", hidden: true, addedById: OWNER }),
    ]);
  });

  it("refuses to record a piece for a stranger or while editing is off", async () => {
    expect(
      await refusal(recordPiece(as(STRANGER), COUNTRY, { title: "Venceia", type: "place" }))
    ).toBe("FORBIDDEN");
    jest.mocked(refreshWikiosEditingFlag).mockResolvedValue(false);
    expect(
      await refusal(recordPiece(as(OWNER), COUNTRY, { title: "Venceia", type: "place" }))
    ).toBe("FORBIDDEN");
    expect(store.pages).toHaveLength(0);
  });

  it("lets the owner pin a category page that has no record yet, typed from its infobox", async () => {
    onWiki("Venceia", "{{Infobox settlement}}");
    await setCuration(as(OWNER), COUNTRY, { title: "Venceia", pinned: true });
    expect(store.pages).toEqual([
      expect.objectContaining({ title: "Venceia", type: "place", pinned: true, hidden: false }),
    ]);

    await setCuration(as(OWNER), COUNTRY, { title: "Venceia", hidden: true });
    expect(store.pages).toEqual([expect.objectContaining({ pinned: true, hidden: true })]);
  });

  it("lets a co-author type a new piece but never retype one that has a record", async () => {
    coauthorOnTeam2();
    onWiki("Venceia", "{{Infobox settlement}}\n[[Category:Caphiria lore]]");
    await recordPiece(as(COAUTHOR), COUNTRY, { title: "Venceia", type: "place" });
    expect(store.pages).toEqual([expect.objectContaining({ type: "place" })]);

    await recordPiece(as(OWNER), COUNTRY, { title: "Venceia", type: "event" });
    expect(store.pages).toEqual([expect.objectContaining({ type: "event" })]);

    await recordPiece(as(COAUTHOR), COUNTRY, { title: "Venceia", type: "person" });
    expect(store.pages).toEqual([expect.objectContaining({ type: "event" })]);
  });

  it("never records, curates or adds a deleted page", async () => {
    onWiki("Venceia", "{{Infobox settlement}}\n[[Category:Caphiria lore]]");
    await recordPiece(as(OWNER), COUNTRY, { title: "Venceia", type: "place" });
    await addExistingPiece(as(OWNER), COUNTRY, { title: "Venceia", type: "place" });
    await setCuration(as(OWNER), COUNTRY, { title: "Elsewhere page", pinned: true }).catch(
      () => undefined
    );
    const options = jest.mocked(readVisiblePage).mock.calls.map((call) => call[2]);
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.every((option) => option?.includeArchived === false)).toBe(true);
  });

  it("refuses curation by a co-author", async () => {
    store.authors.push({
      countryId: COUNTRY,
      userId: COAUTHOR,
      addedById: OWNER,
      createdAt: new Date(),
    });
    onWiki("Venceia", "{{Infobox settlement}}");
    expect(
      await refusal(setCuration(as(COAUTHOR), COUNTRY, { title: "Venceia", hidden: true }))
    ).toBe("FORBIDDEN");
    expect(store.pages).toHaveLength(0);
  });

  it("adds an existing page under the title it leads to, and refuses one that does not exist", async () => {
    onWiki("Senate", "{{Infobox organization}}", "Senate of Caphiria");
    expect(
      await addExistingPiece(as(OWNER), COUNTRY, { title: "Senate", type: "organisation" })
    ).toEqual({ title: "Senate of Caphiria" });
    expect(store.pages).toEqual([
      expect.objectContaining({ title: "Senate of Caphiria", type: "organisation", hidden: false }),
    ]);

    expect(
      await refusal(addExistingPiece(as(OWNER), COUNTRY, { title: "No Such Page", type: "event" }))
    ).toBe("NOT_FOUND");
    expect(store.pages).toHaveLength(1);
  });
});
