/**
 * Fixtures for the moderator content suites (mod-content, mod-edit): Eurth (active), Aurora and Old (archived)
 * realms, sitewide categories, threads with timed posts, open and handled reports, two site admins.
 */
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";

export const USER_ROLE = { name: "user", level: 100 };
export const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
/** Another site admin, the author of `t_admin` and its first two posts. */
export const admin2 = {
  id: "u_a2",
  clerkUserId: "admin2",
  countryId: null,
  role: { name: "admin", level: 10 },
};
export const member = { id: "u_m", clerkUserId: "member", countryId: "c1", role: USER_ROLE };
export const moderatorOf = (id: string, realmIds: string[], categoryIds: string[] = []) => ({
  id,
  clerkUserId: id,
  countryId: null,
  role: USER_ROLE,
  mod: { siteAdmin: false, realmIds, categoryIds },
});
export const eurthMod = moderatorOf("u_eurth", ["r_eurth"]);
export const oldMod = moderatorOf("u_old", ["r_old"]);
export const generalMod = moderatorOf("u_gen", [], ["cat_general"]);

export const at = (minute: number) => new Date(Date.UTC(2026, 9, 9, 12, minute));

export const site = (id: string, key: string, extra: Row = {}): Row => ({
  id,
  key,
  name: key,
  scope: "site",
  realmId: null,
  visibility: "public",
  postRole: "any",
  icAllowed: false,
  ...extra,
});
export const realmCat = (realmId: string, key: string, icAllowed = false): Row => ({
  id: `${realmId}_${key}`,
  key,
  name: key,
  scope: "realm",
  realmId,
  visibility: "public",
  postRole: "any",
  icAllowed,
});
export const categories: Row[] = [
  site("cat_general", "general"),
  site("cat_find", "find-a-realm"),
  site("cat_side", "side-games", { icAllowed: true }),
  site("cat_reports", "reports", { visibility: "reporter_staff" }),
  realmCat("r_eurth", "hub"),
  realmCat("r_eurth", "character-threads", true),
  realmCat("r_eurth", "current-events", true),
  realmCat("r_aurora", "hub"),
  realmCat("r_old", "hub"),
];
export const realms: Row[] = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_aurora", slug: "aurora", name: "Aurora", status: "active", ownerId: "aurora_founder" },
  { id: "r_old", slug: "old", name: "Old", status: "archived", ownerId: "old_founder" },
];

export const thread = (id: string, categoryId: string, extra: Row = {}): Row => ({
  id,
  categoryId,
  title: `Thread ${id}`,
  authorUserId: "u_m",
  authorPersonaId: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
  postCount: 3,
  lastPostAt: at(2),
  createdAt: at(0),
  ...extra,
});
export const post = (id: string, threadId: string, minute: number, extra: Row = {}): Row => ({
  id,
  threadId,
  authorUserId: "u_m",
  authorPersonaId: null,
  contentHtml: `<p>Post ${id}</p>`,
  plainText: `Post ${id}`,
  hidden: false,
  editedAt: null,
  createdAt: at(minute),
  ...extra,
});
export const report = (id: string, targetType: string, targetId: string, extra: Row = {}): Row => ({
  id,
  targetType,
  targetId,
  categoryId: "r_eurth_hub",
  reporterId: "u_r",
  reason: "Spam",
  status: "open",
  createdAt: at(5),
  ...extra,
});

export const users: Row[] = [
  { id: "u_a", clerkUserId: "admin", role: { name: "admin", level: 10 } },
  { id: "u_a2", clerkUserId: "admin2", role: { name: "admin", level: 10 } },
  { id: "u_m", clerkUserId: "member", role: USER_ROLE },
];

export const seed = () => ({
  categories,
  realms,
  users,
  threads: [
    thread("t_general", "cat_general"),
    thread("t_eurth", "r_eurth_hub", { postCount: 2, lastPostAt: at(1) }),
    thread("t_persona", "r_eurth_character-threads", { authorPersonaId: "persona1", postCount: 1 }),
    thread("t_mixed", "r_eurth_character-threads", { postCount: 2 }),
    thread("t_old", "r_old_hub", { postCount: 2, lastPostAt: at(1) }),
    thread("t_admin", "r_eurth_hub", { authorUserId: "u_a2", postCount: 3 }),
  ],
  posts: [
    post("p_g1", "t_general", 0),
    post("p_g2", "t_general", 1),
    post("p_g3", "t_general", 2),
    post("p_e1", "t_eurth", 0),
    post("p_e2", "t_eurth", 1),
    post("p_pc1", "t_persona", 0, { authorPersonaId: "persona1" }),
    post("p_m1", "t_mixed", 0),
    post("p_m2", "t_mixed", 1, { authorPersonaId: "persona2" }),
    post("p_o1", "t_old", 0),
    post("p_o2", "t_old", 1),
    post("p_a1", "t_admin", 0, { authorUserId: "u_a2" }),
    post("p_a2", "t_admin", 1, { authorUserId: "u_a2" }),
    post("p_a3", "t_admin", 2),
  ],
  reports: [
    report("rep_thread", "thread", "t_eurth"),
    report("rep_post", "post", "p_e2"),
    report("rep_done", "post", "p_e2", { status: "resolved" }),
    report("rep_other", "thread", "t_general", { categoryId: "cat_general" }),
  ],
  links: [{ id: "l1", postSource: "native", postRef: "p_e1", activityId: "act1", storyline: null }],
});

export type Store = ReturnType<typeof forumStore>;
export const threadIn = (store: Store, id: string) => store.state.threads.find((t) => t.id === id)!;
export const postIn = (store: Store, id: string) => store.state.posts.find((p) => p.id === id)!;

/** Every action writes its log row through the transaction client, never through the outer client. */
export function expectOneLog(store: Store, row: Row): Row {
  expect(store.logs).toHaveLength(1);
  expect(store.logs[0]).toMatchObject(row);
  expect(store.db.forumModLog.create).not.toHaveBeenCalled();
  return detailOf(store.logs[0]);
}
