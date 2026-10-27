/** @jest-environment node */
/**
 * Forum authors: how a post's author is shown, and who may moderate them. A persona is shown by its own name and
 * picture only, never with its player's flag or name, even when its account is gone. Realm moderators hide and
 * sanction members' posts but never a fellow moderator's, a site admin's or their own; a site admin edits another
 * admin's posts but never sanctions them. M8: a report carries its target's author, so a moderator's queue leaves out
 * reports about their own content. Content imported without an IxStats author (a null `authorUserId`) is never
 * queried, never the viewer, never sanctionable, moderable by any moderator of its category, and editable by nobody.
 *
 * Folds mod-report-authors, imported-authors, preview-author and authors-persona-type.
 */
import {
  authorModeration,
  authorsOf,
  canSeeThread,
  editPost,
  fileReport,
  listReports,
  modEditPost,
  moderatorContext,
  moderatorContexts,
  setPostHidden,
  setThreadFlag,
} from "~/server/modules/thinkpages-forum";
import { previewAuthorOf, type AuthorMaps } from "~/server/modules/thinkpages-forum/authors";
import {
  admin,
  eurthMod,
  generalMod,
  member,
  post,
  postIn,
  report,
  seed,
  thread,
  threadIn,
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

  it("never queries a null author (imported content); any moderator of the category hides it, nobody sanctions it", async () => {
    const store = authorsStore();
    const of = await authorModeration(store.db as never, eurthMod, [null, "u_m", null]);
    expect(store.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["u_m"] } } })
    );
    expect(of(null, eurthHub)).toEqual(MODERABLE_ONLY);
    expect(of(null, general)).toEqual(NEITHER);
    expect((await authorModeration(store.db as never, admin, [null]))(null, general)).toEqual(
      MODERABLE_ONLY
    );
    expect(store.db.user.findMany).toHaveBeenCalledTimes(1);
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

const storeWith = (extra: { posts?: Row[]; reports?: Row[] } = {}) => {
  const base = seed();
  return forumStore({
    ...base,
    posts: [...base.posts, ...(extra.posts ?? [])],
    reports: extra.reports ?? [],
  });
};

describe("fileReport records the target's author (M8)", () => {
  it.each([
    ["post", "p_a1", "u_a2"],
    ["thread", "t_admin", "u_a2"],
    ["post", "p_imported", null],
  ] as const)("on a %s (%s)", async (targetType, targetId, author) => {
    const store = storeWith({
      posts: [post("p_imported", "t_eurth", 9, { authorUserId: null, importedAuthorName: "Old" })],
    });
    await fileReport(store.db as never, member, { targetType, targetId, reason: "Spam here" });
    expect(store.state.reports).toEqual([
      expect.objectContaining({ targetId, targetAuthorId: author }),
    ]);
  });
});

describe("listReports leaves out a moderator's own content by the stored author (M8)", () => {
  const reports = [
    report("rep_mine", "post", "p_e1", { targetAuthorId: "u_eurth" }),
    report("rep_theirs", "post", "p_e2", { targetAuthorId: "u_m" }),
    report("rep_unattributed", "post", "p_e2", { targetAuthorId: null }),
  ];

  it("in one query for the page, without a scan of the report history", async () => {
    const store = storeWith({ reports });
    const { rows, total } = await listReports(store.db as never, eurthMod, { status: "open" }, 1);
    expect(rows.map((r) => r.id).sort()).toEqual(["rep_theirs", "rep_unattributed"]);
    expect(total).toBe(2);
    expect(store.db.forumReport.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.forumReport.findMany.mock.calls[0]![0]!.where).toMatchObject({
      OR: [{ targetAuthorId: null }, { targetAuthorId: { not: "u_eurth" } }],
    });
  });

  it("marks a site admin's own target by the stored author, even once it is gone (review #5)", async () => {
    const store = storeWith({
      reports: [report("rep_own_gone", "post", "p_deleted", { targetAuthorId: "u_a" })],
    });
    const { rows } = await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(rows[0]).toMatchObject({ ownTarget: true, reporterId: null });
  });

  it("puts no author condition on a site admin's queue", async () => {
    const store = storeWith({ reports });
    const { total } = await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(total).toBe(3);
    expect(store.db.forumReport.findMany.mock.calls[0]![0]!.where).not.toHaveProperty("OR");
  });
});

const IMPORTED = { authorUserId: null, importedAuthorName: "OldName" };

/** The moderator fixtures plus an imported thread in Eurth's Hub and an imported reply in General. */
function importedStore() {
  const base = seed();
  return forumStore({
    ...base,
    threads: [...base.threads, thread("t_imported", "r_eurth_hub", IMPORTED)],
    posts: [
      ...base.posts,
      post("p_i1", "t_imported", 0, IMPORTED),
      post("p_i2", "t_imported", 1, IMPORTED),
      post("p_g_imported", "t_general", 3, IMPORTED),
    ],
  });
}

describe("canSeeThread with a null author", () => {
  const reports = {
    id: "cat_reports",
    scope: "site",
    realmId: null,
    visibility: "reporter_staff",
  };
  const imported = { authorUserId: null, hidden: false };

  it("keeps a Reports thread without an author to the category's moderators", () => {
    expect(canSeeThread(member, imported, reports)).toBe(false);
    expect(canSeeThread(null, imported, reports)).toBe(false);
    expect(canSeeThread(admin, imported, reports)).toBe(true);
  });

  it("shows a public thread without an author to everyone", () => {
    const general = { ...reports, id: "cat_general", visibility: "public" };
    expect(canSeeThread(null, imported, general)).toBe(true);
    expect(canSeeThread(member, imported, general)).toBe(true);
  });
});

describe("moderating content without an IxStats author", () => {
  it("lets a realm moderator hide and unhide an imported post without looking up its author", async () => {
    const store = importedStore();
    await setPostHidden(store.db as never, eurthMod, { postId: "p_i2", hidden: true });
    expect(postIn(store, "p_i2").hidden).toBe(true);
    await setPostHidden(store.db as never, eurthMod, { postId: "p_i2", hidden: false });
    expect(postIn(store, "p_i2").hidden).toBe(false);
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets a category moderator lock an imported thread", async () => {
    const store = importedStore();
    await setThreadFlag(store.db as never, eurthMod, {
      threadId: "t_imported",
      flag: "locked",
      value: true,
    });
    expect(threadIn(store, "t_imported").locked).toBe(true);
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets a category moderator edit an imported post", async () => {
    const store = importedStore();
    await modEditPost(store.db as never, generalMod, {
      postId: "p_g_imported",
      html: "<p>Tidied</p>",
      note: "Formatting",
    });
    expect(postIn(store, "p_g_imported").plainText).toBe("Tidied");
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("still keeps the actor to the categories they moderate", async () => {
    const store = importedStore();
    await expect(
      setPostHidden(store.db as never, generalMod, { postId: "p_i2", hidden: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postIn(store, "p_i2").hidden).toBe(false);
  });
});

describe("editPost on an imported post", () => {
  it("is the author's only, and an imported post has none", async () => {
    const store = importedStore();
    await expect(
      editPost(store.db as never, member, {
        postId: "p_g_imported",
        editedAt: null,
        html: "<p>Mine now</p>",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Only the author can edit this post." });
    expect(postIn(store, "p_g_imported").plainText).toBe("Post p_g_imported");
  });
});

const previewMaps: AuthorMaps = {
  users: new Map([
    [
      "u1",
      {
        name: "jane",
        handle: "jane",
        avatarUrl: "https://img.example/jane.png",
        flagUrl: "https://flags.example/eurth.png",
      },
    ],
  ]),
  personas: new Map([
    [
      "p1",
      {
        displayName: "Eurth Daily",
        username: "eurthdaily",
        avatarUrl: "https://img.example/p.png",
        personaType: "media",
      },
    ],
  ]),
};

describe("previewAuthorOf", () => {
  it("shows a persona by name and picture only, even when the row's user has a flag", () => {
    const author = previewAuthorOf(
      { authorUserId: "u1", authorPersonaId: "p1", importedAuthorName: null },
      previewMaps,
      "Member"
    );
    expect(author).toEqual({
      name: "Eurth Daily",
      avatarUrl: "https://img.example/p.png",
      flagUrl: null,
      persona: true,
      personaType: "media",
    });
    expect(JSON.stringify(author)).not.toMatch(/jane|eurth\.png/);
  });

  it("shows a persona whose account is gone as a bare persona, never its player", () => {
    const author = previewAuthorOf(
      { authorUserId: "u1", authorPersonaId: "p_gone", importedAuthorName: null },
      previewMaps,
      "Member"
    );
    expect(author).toEqual({
      name: "Persona",
      avatarUrl: null,
      flagUrl: null,
      persona: true,
      personaType: null,
    });
    expect(JSON.stringify(author)).not.toMatch(/jane|eurth\.png/);
  });

  it("shows a member by public name, picture and flag", () => {
    expect(
      previewAuthorOf(
        { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null },
        previewMaps,
        "Member"
      )
    ).toEqual({
      name: "jane",
      avatarUrl: "https://img.example/jane.png",
      flagUrl: "https://flags.example/eurth.png",
      persona: false,
      personaType: null,
    });
  });

  it("falls back to the imported name, then to the fallback, with no flag", () => {
    const row = { authorUserId: null, authorPersonaId: null };
    expect(
      previewAuthorOf({ ...row, importedAuthorName: "OldName" }, previewMaps, "Member")
    ).toMatchObject({
      name: "OldName",
      flagUrl: null,
    });
    expect(previewAuthorOf({ ...row, importedAuthorName: null }, previewMaps, "Member").name).toBe(
      "Member"
    );
  });
});

function personaDb(accounts: Array<{ id: string; accountType: string }>) {
  return {
    user: { findMany: jest.fn(async () => []) },
    thinkpagesAccount: {
      findMany: jest.fn(async () =>
        accounts.map((a) => ({
          id: a.id,
          displayName: `Name ${a.id}`,
          username: `user_${a.id}`,
          profileImageUrl: null,
          accountType: a.accountType,
        }))
      ),
    },
  };
}

describe("authorsOf persona types", () => {
  it("gives a persona preview its type and still no flag", async () => {
    const maps = await authorsOf(
      personaDb([{ id: "m", accountType: "media" }]) as never,
      [],
      ["m"]
    );
    const preview = previewAuthorOf(
      { authorUserId: "u_player", authorPersonaId: "m", importedAuthorName: null },
      maps,
      "Member"
    );
    expect(preview).toEqual({
      name: "Name m",
      avatarUrl: null,
      flagUrl: null,
      persona: true,
      personaType: "media",
    });
  });
});
