/** @jest-environment node */
/**
 * M8: a report carries its target's author, so a moderator's queue leaves out reports about their own content with
 * a plain where, never a scan of every report in scope and status.
 */
import { fileReport, listReports } from "~/server/modules/thinkpages-forum";
import { admin, eurthMod, member, post, report, seed } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore, type Row } from "~/tests/helpers/forum-store-fake";

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

  it("puts no author condition on a site admin's queue", async () => {
    const store = storeWith({ reports });
    const { total } = await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(total).toBe(3);
    expect(store.db.forumReport.findMany.mock.calls[0]![0]!.where).not.toHaveProperty("OR");
  });
});
