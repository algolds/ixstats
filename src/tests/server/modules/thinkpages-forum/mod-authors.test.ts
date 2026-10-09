/** @jest-environment node */
import {
  authorModeration,
  moderatorContext,
  moderatorContexts,
} from "~/server/modules/thinkpages-forum";
import {
  admin,
  eurthMod,
  generalMod,
  member,
  seed,
  USER_ROLE,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const eurthHub = { id: "r_eurth_hub", scope: "realm", realmId: "r_eurth" };
const general = { id: "cat_general", scope: "site", realmId: null };
const aurora = { id: "r_aurora_hub", scope: "realm", realmId: "r_aurora" };

/** The fixtures plus Eurth's founder and officer, a category moderator, and the moderators themselves as users. */
function authorsStore() {
  const base = seed();
  const users: Row[] = [
    ...base.users,
    { id: "u_f", clerkUserId: "founder", role: USER_ROLE },
    { id: "u_o", clerkUserId: "officer", role: USER_ROLE },
    { id: "u_x", clerkUserId: "former", role: USER_ROLE },
    { id: "u_gen", clerkUserId: "u_gen", role: USER_ROLE },
    { id: "u_eurth", clerkUserId: "u_eurth", role: USER_ROLE },
  ];
  return forumStore({
    ...base,
    users,
    officers: [
      { realmId: "r_eurth", userId: "officer", powers: ["board"] },
      { realmId: "r_eurth", userId: "former", powers: ["claims"] },
      { realmId: "r_eurth", userId: "u_eurth", powers: ["board"] },
    ],
    categoryModerators: [{ categoryId: "cat_general", userId: "u_gen" }],
  });
}

const BOTH = { moderable: true, sanctionable: true };
const MODERABLE_ONLY = { moderable: true, sanctionable: false };
const NEITHER = { moderable: false, sanctionable: false };

describe("authorModeration", () => {
  it("lets a realm moderator hide and sanction a member's posts", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, eurthMod, ["u_m"]);
    expect(of("u_m", eurthHub)).toEqual(BOTH);
  });

  it("offers a realm moderator nothing on a site admin's posts (only site admins moderate them)", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, eurthMod, ["u_a2"]);
    expect(of("u_a2", eurthHub)).toEqual(NEITHER);
  });

  it("offers a site admin hide and edit on another admin's posts, never a sanction", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, admin, ["u_a2"]);
    expect(of("u_a2", eurthHub)).toEqual(MODERABLE_ONLY);
  });

  it("never offers Warn or Ban on a fellow moderator of the place: founder, board officer, category moderator", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, admin, ["u_f", "u_o", "u_gen"]);
    expect(of("u_f", eurthHub)).toEqual(MODERABLE_ONLY);
    expect(of("u_o", eurthHub)).toEqual(MODERABLE_ONLY);
    expect(of("u_gen", general)).toEqual(MODERABLE_ONLY);
  });

  it("sanctions moderators elsewhere, and officers without the board power", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, admin, ["u_f", "u_gen", "u_x"]);
    expect(of("u_f", general)).toEqual(BOTH);
    expect(of("u_gen", aurora)).toEqual(BOTH);
    expect(of("u_x", eurthHub)).toEqual(BOTH);
  });

  it("never offers Warn or Ban on the viewer's own posts", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, generalMod, ["u_gen"]);
    expect(of("u_gen", general)).toEqual(MODERABLE_ONLY);
  });

  it("offers nothing where the viewer does not moderate the category", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, generalMod, ["u_m"]);
    expect(of("u_m", eurthHub)).toEqual(NEITHER);
    expect((await authorModeration(store.db as never, member, ["u_m"]))("u_m", general)).toEqual(
      NEITHER
    );
  });

  it("treats an author whose user row is gone as moderable and not sanctionable", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, eurthMod, ["u_gone"]);
    expect(of("u_gone", eurthHub)).toEqual(MODERABLE_ONLY);
  });

  it("loads a page's distinct authors in one user query and three moderator queries", async () => {
    const store = authorsStore();
    await authorModeration(store.db as never, admin, ["u_m", "u_f", "u_m", "u_o", "u_a2"]);
    expect(store.db.user.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["u_m", "u_f", "u_o", "u_a2"] } } })
    );
    expect(store.db.realm.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.realmOfficer.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.forumCategoryModerator.findMany).toHaveBeenCalledTimes(1);
  });

  it("spends no query on an empty page or a page of site admins' posts beyond the user lookup", async () => {
    const store = authorsStore();
    await authorModeration(store.db as never, admin, []);
    expect(store.db.user.findMany).not.toHaveBeenCalled();
    await authorModeration(store.db as never, admin, ["u_a2"]);
    expect(store.db.realm.findMany).not.toHaveBeenCalled();
  });
});

describe("moderatorContexts", () => {
  it("gives every member the context moderatorContext gives them alone", async () => {
    const store = authorsStore();
    const members = store.state.users.map((u) => ({
      id: String(u.id),
      clerkUserId: String(u.clerkUserId),
      role: u.role as { name: string; level: number },
      countryId: null,
    }));
    const batched = await moderatorContexts(store.db as never, members);
    for (const m of members) {
      expect(batched.get(m.id)).toEqual(await moderatorContext(store.db as never, m));
    }
  });
});
