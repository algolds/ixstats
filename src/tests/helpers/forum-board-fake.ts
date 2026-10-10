/**
 * Fixtures and an in-memory store for the realm board suites: Eurth (active, founder, a `board` officer and a
 * `claims` officer) and Aurora (active) with their board categories and board threads, Old (archived), members,
 * a visitor, a persona and nations. Built on `forumStore`, adding nations (`country`), personas
 * (`thinkpagesAccount`), `orderBy` for post lists and a `groupBy` over nations.
 */
import { banRow, type BanRow } from "~/tests/helpers/forum-ban-fake";
import { forumStore, matches, type Row, type StoreState } from "~/tests/helpers/forum-store-fake";

export const USER_ROLE = { name: "user", level: 100 };
export const at = (minute: number) => new Date(Date.UTC(2026, 9, 10, 12, minute));

const viewer = (id: string, extra: object = {}) => ({
  id,
  clerkUserId: `clerk_${id}`,
  countryId: null,
  role: USER_ROLE,
  ...extra,
});
const modOf = (realmIds: string[]) => ({ mod: { siteAdmin: false, realmIds, categoryIds: [] } });

export const admin = viewer("u_admin", { role: { name: "admin", level: 10 } });
/** Owns c_eurth in Eurth. */
export const member = viewer("u_member", { countryId: "c_eurth" });
export const member2 = viewer("u_member2", { countryId: "c_eurth2" });
/** Owns c_aurora in Aurora: a visitor on Eurth's board. */
export const visitor = viewer("u_visitor", { countryId: "c_aurora" });
/** Holds no nation. */
export const plain = viewer("u_plain");
/** Founder of Eurth (`Realm.ownerId` is a Clerk id), no nation there. */
export const founder = viewer("u_founder", { clerkUserId: "founder", ...modOf(["r_eurth"]) });
/** Officer of Eurth with the `board` power, owns c_officer. */
export const officer = viewer("u_officer", { countryId: "c_officer", ...modOf(["r_eurth"]) });
/** Officer of Eurth with only `claims`: no moderation. */
export const claimsOfficer = viewer("u_claims", { countryId: null });
export const banned = viewer("u_banned", { countryId: "c_banned" });

export const realms: Row[] = [
  {
    id: "r_eurth",
    slug: "eurth",
    name: "Eurth",
    status: "active",
    ownerId: "founder",
    emblemUrl: "https://img.example/eurth.png",
    thumbnail: "https://img.example/eurth-thumb.png",
    boardVisitorsAllowed: true,
    boardSlowModeSeconds: 0,
  },
  {
    id: "r_aurora",
    slug: "aurora",
    name: "Aurora",
    status: "active",
    ownerId: "aurora_founder",
    emblemUrl: null,
    thumbnail: null,
    boardVisitorsAllowed: true,
    boardSlowModeSeconds: 0,
  },
  {
    id: "r_old",
    slug: "old",
    name: "Old",
    status: "archived",
    ownerId: "old_founder",
    emblemUrl: null,
    thumbnail: null,
    boardVisitorsAllowed: true,
    boardSlowModeSeconds: 0,
  },
  {
    id: "r_draft",
    slug: "draft",
    name: "Draft",
    status: "draft",
    ownerId: "draft_founder",
    emblemUrl: null,
    thumbnail: null,
    boardVisitorsAllowed: true,
    boardSlowModeSeconds: 0,
  },
];

const category = (realmId: string, key: string, extra: Row = {}): Row => ({
  id: `cat_${realmId}_${key}`,
  key,
  name: key,
  scope: "realm",
  realmId,
  visibility: "public",
  postRole: "any",
  icAllowed: key !== "hub",
  style: key === "board" ? "board" : "ooc",
  ...extra,
});
export const categories: Row[] = ["r_eurth", "r_aurora", "r_old", "r_draft"].flatMap((r) => [
  category(r, "board"),
  category(r, "hub"),
  category(r, "character-threads"),
]);

const boardThread = (realmId: string): Row => ({
  id: `t_board_${realmId}`,
  categoryId: `cat_${realmId}_board`,
  title: "board",
  authorUserId: null,
  authorPersonaId: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
  postCount: 0,
  lastPostAt: at(0),
  createdAt: at(0),
});
export const BOARD_THREAD = "t_board_r_eurth";
export const BOARD_CATEGORY = "cat_r_eurth_board";

export const boardPost = (id: string, minute: number, extra: Row = {}): Row => ({
  id,
  threadId: BOARD_THREAD,
  authorUserId: "u_member",
  authorPersonaId: null,
  importedAuthorName: null,
  contentHtml: `<p>Message ${id}</p>`,
  plainText: `Message ${id}`,
  hidden: false,
  editedAt: null,
  createdAt: at(minute),
  replyToPostId: null,
  continuedThreadId: null,
  ...extra,
});

const userRow = (id: string, extra: Row = {}): Row => ({
  id,
  clerkUserId: `clerk_${id}`,
  handle: id.replace("u_", ""),
  wikiUsername: null,
  countryId: null,
  country: { name: `Nation of ${id}`, flag: `https://flags.example/${id}.png` },
  role: USER_ROLE,
  ...extra,
});
export const users: Row[] = [
  userRow("u_admin", { role: { name: "admin", level: 10 } }),
  userRow("u_member", { countryId: "c_eurth" }),
  userRow("u_member2", { countryId: "c_eurth2" }),
  userRow("u_visitor", { countryId: "c_aurora" }),
  userRow("u_plain"),
  userRow("u_founder", { clerkUserId: "founder" }),
  userRow("u_officer", { countryId: "c_officer" }),
  userRow("u_claims", { clerkUserId: "clerk_claims" }),
  userRow("u_banned", { countryId: "c_banned" }),
];

const nation = (id: string, ownerUserId: string, realmId: string, gdp = 1): Row => ({
  id,
  ownerUserId,
  realmId,
  currentTotalGdp: gdp,
});
export const countries: Row[] = [
  nation("c_eurth", "u_member", "r_eurth"),
  nation("c_eurth2", "u_member2", "r_eurth"),
  nation("c_officer", "u_officer", "r_eurth"),
  nation("c_banned", "u_banned", "r_eurth"),
  nation("c_aurora", "u_visitor", "r_aurora"),
];

export const personas: Row[] = [
  {
    id: "pa_news",
    clerkUserId: "clerk_u_member",
    isActive: true,
    accountType: "character",
    displayName: "Eurth Daily",
    username: "eurthdaily",
    profileImageUrl: "https://img.example/daily.png",
  },
  {
    id: "pa_visitor",
    clerkUserId: "clerk_u_visitor",
    isActive: true,
    accountType: "character",
    displayName: "Aurora Wire",
    username: "aurorawire",
    profileImageUrl: null,
  },
];

export const officers: Row[] = [
  { id: "o1", realmId: "r_eurth", userId: "clerk_u_officer", powers: ["board"] },
  { id: "o2", realmId: "r_eurth", userId: "clerk_u_claims", powers: ["claims"] },
];

export const seed = (extra: Partial<StoreState> = {}): Partial<StoreState> => ({
  realms,
  categories,
  threads: ["r_eurth", "r_aurora", "r_old", "r_draft"].map(boardThread),
  users,
  officers,
  ...extra,
});

type Order = Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
interface ListArgs {
  where?: Row;
  orderBy?: Order;
  take?: number;
  skip?: number;
}

const comparable = (value: unknown): number | string =>
  value instanceof Date ? value.getTime() : typeof value === "number" ? value : String(value ?? "");

function sorted(rows: Row[], orderBy?: Order): Row[] {
  if (!orderBy) return rows;
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [field, dir] of keys) {
      const [x, y] = [comparable(a[field]), comparable(b[field])];
      if (x === y) continue;
      return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  });
}

/** The forum store plus nations, personas and ordered post reads. */
export function boardStore(
  stateSeed: Partial<StoreState> = seed(),
  extra: { countries?: Row[]; personas?: Row[] } = {}
) {
  const store = forumStore(stateSeed);
  const nations = extra.countries ?? countries;
  const accounts = extra.personas ?? personas;
  const patch = <T extends object>(client: T): T => {
    const target = client as Record<string, unknown>;
    target.country = {
      findMany: jest.fn(async ({ where }: ListArgs = {}) =>
        nations.filter((c) => matches(c, where))
      ),
      groupBy: jest.fn(async ({ where }: ListArgs = {}) => {
        const owners = new Set(
          nations
            .filter((c) => matches(c, where))
            .map((c) => c.ownerUserId)
            .filter((o): o is string => typeof o === "string")
        );
        return [...owners].map((ownerUserId) => ({ ownerUserId }));
      }),
    };
    target.thinkpagesAccount = {
      findMany: jest.fn(async ({ where }: ListArgs = {}) =>
        accounts.filter((a) => matches(a, where))
      ),
      findFirst: jest.fn(
        async ({ where }: ListArgs = {}) => accounts.find((a) => matches(a, where)) ?? null
      ),
    };
    const posts = target.forumPost as {
      findMany: unknown;
      create: (args: { data: Row }) => unknown;
    };
    // Prisma's column defaults, which the generic store does not know.
    const createPost = posts.create;
    posts.create = jest.fn(({ data }: { data: Row }) =>
      createPost({
        data: {
          hidden: false,
          editedAt: null,
          replyToPostId: null,
          continuedThreadId: null,
          importedAuthorName: null,
          authorPersonaId: null,
          ...data,
        },
      })
    );
    const threads = target.forumThread as { create: (args: { data: Row }) => unknown };
    const createThread = threads.create;
    threads.create = jest.fn(({ data }: { data: Row }) =>
      createThread({
        data: {
          hidden: false,
          archived: false,
          locked: false,
          pinned: false,
          postCount: 0,
          authorPersonaId: null,
          importedAuthorName: null,
          ...data,
        },
      })
    );
    posts.findMany = jest.fn(async ({ where, orderBy, take, skip = 0 }: ListArgs = {}) =>
      sorted(
        store.state.posts.filter((p) => matches(p, where)),
        orderBy
      )
        .slice(skip, take === undefined ? undefined : skip + take)
        .map((p) => ({ ...p }))
    );
    return client;
  };
  patch(store.db);
  patch(store.tx);
  return store;
}

export type BoardStore = ReturnType<typeof boardStore>;
export const postIn = (store: BoardStore, id: string) =>
  store.state.posts.find((p) => p.id === id)!;
export const threadIn = (store: BoardStore, id: string) =>
  store.state.threads.find((t) => t.id === id)!;

/** A forum ban row (see `banRow`) as a store row. */
export const ban = (extra: Partial<BanRow>): Row => ({ ...banRow(extra) });
