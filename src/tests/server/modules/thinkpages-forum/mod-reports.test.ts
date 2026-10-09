/** @jest-environment node */
import {
  fileReport,
  listReports,
  REPORTS_PER_PAGE,
  resolveReport,
} from "~/server/modules/thinkpages-forum";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const USER_ROLE = { name: "user", level: 100 };
const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const member = { id: "u_m", clerkUserId: "member", countryId: "c1", role: USER_ROLE };
const reporter = { id: "u_r", clerkUserId: "reporter", countryId: "c2", role: USER_ROLE };
const moderatorOf = (id: string, realmIds: string[], categoryIds: string[] = []) => ({
  id,
  clerkUserId: id,
  countryId: null,
  role: USER_ROLE,
  mod: { siteAdmin: false, realmIds, categoryIds },
});
const eurthMod = moderatorOf("u_eurth", ["r_eurth"]);
const generalMod = moderatorOf("u_gen", [], ["cat_general"]);

const at = (minute: number) => new Date(Date.UTC(2026, 9, 9, 12, minute));

const category = (
  id: string,
  key: string,
  scope: string,
  realmId: string | null,
  visibility = "public"
): Row => ({
  id,
  key,
  name: key === "hub" ? "Hub" : key,
  scope,
  realmId,
  visibility,
  postRole: "any",
  icAllowed: false,
});
const categories: Row[] = [
  category("cat_general", "general", "site", null),
  category("cat_reports", "reports", "site", null, "reporter_staff"),
  category("r_eurth_hub", "hub", "realm", "r_eurth"),
  category("r_draft_hub", "hub", "realm", "r_draft"),
  category("default_hub", "hub", "realm", "default"),
];
const realms: Row[] = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_draft", slug: "draft-land", name: "Draft Land", status: "draft", ownerId: "founder" },
];
const thread = (id: string, categoryId: string, extra: Row = {}): Row => ({
  id,
  categoryId,
  title: `Thread ${id}`,
  authorUserId: "u_m",
  hidden: false,
  ...extra,
});
const post = (id: string, threadId: string, extra: Row = {}): Row => ({
  id,
  threadId,
  authorUserId: "u_m",
  plainText: `Post ${id}`,
  hidden: false,
  createdAt: at(0),
  ...extra,
});

const seed = () => ({
  categories,
  realms,
  threads: [
    thread("t_general", "cat_general"),
    thread("t_eurth", "r_eurth_hub"),
    thread("t_hidden", "cat_general", { hidden: true }),
    thread("t_report", "cat_reports"),
    thread("t_draft", "r_draft_hub"),
    thread("t_ixworld", "default_hub"),
  ],
  posts: [
    post("p_general", "t_general", { plainText: "x".repeat(300) }),
    post("p_eurth", "t_eurth"),
    post("p_hidden", "t_eurth", { hidden: true }),
    post("p_mine", "t_eurth", { authorUserId: "u_r" }),
  ],
});

function reportsStore(bans: BanRow[] = [], extra: { reports?: Row[] } = {}) {
  const store = forumStore({ ...seed(), ...extra });
  const db = { ...store.db, forumBan: forumBanFake(bans) };
  return { ...store, db };
}

const fileAs = (
  store: ReturnType<typeof reportsStore>,
  actor: typeof reporter | typeof admin,
  targetType: "thread" | "post",
  targetId: string,
  reason = "This is spam"
) => fileReport(store.db as never, actor, { targetType, targetId, reason });

describe("fileReport", () => {
  it("files an open report on a post with its category, trimmed reason and reporter", async () => {
    const store = reportsStore();
    const { reportId } = await fileAs(store, reporter, "post", "p_eurth", "  Off topic  ");
    expect(store.state.reports).toEqual([
      expect.objectContaining({
        id: reportId,
        targetType: "post",
        targetId: "p_eurth",
        categoryId: "r_eurth_hub",
        reporterId: "u_r",
        reason: "Off topic",
        status: "open",
      }),
    ]);
  });

  it("files a report on a thread with the thread's category", async () => {
    const store = reportsStore();
    await fileAs(store, reporter, "thread", "t_general");
    expect(store.state.reports[0]).toMatchObject({
      targetType: "thread",
      categoryId: "cat_general",
    });
  });

  it("refuses reporting your own post or thread", async () => {
    const store = reportsStore();
    await expect(fileAs(store, reporter, "post", "p_mine")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You can't report your own post.",
    });
    await expect(fileAs(store, member, "thread", "t_general")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You can't report your own thread.",
    });
    expect(store.state.reports).toHaveLength(0);
  });

  it("a site ban refuses (M11); a realm or category ban does not", async () => {
    const banned = reportsStore([banRow({ userId: "u_r", scope: "site" })]);
    await expect(fileAs(banned, reporter, "post", "p_eurth")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(banned.state.reports).toHaveLength(0);

    const placeBanned = reportsStore([
      banRow({ id: "b_realm", userId: "u_r", scope: "realm", scopeId: "r_eurth" }),
      banRow({ id: "b_cat", userId: "u_r", scope: "category", scopeId: "r_eurth_hub" }),
    ]);
    await fileAs(placeBanned, reporter, "post", "p_eurth");
    expect(placeBanned.state.reports).toHaveLength(1);
  });

  it("allows one open report per reporter per target", async () => {
    const store = reportsStore();
    await fileAs(store, reporter, "post", "p_eurth");
    await expect(fileAs(store, reporter, "post", "p_eurth")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await fileAs(store, reporter, "thread", "t_eurth");
    await fileAs(store, admin, "post", "p_eurth");
    expect(store.state.reports).toHaveLength(3);
    store.state.reports[0]!.status = "resolved";
    await fileAs(store, reporter, "post", "p_eurth");
    expect(store.state.reports).toHaveLength(4);
  });

  it("serializes a reporter's reports so a double submit cannot file twice", async () => {
    const store = reportsStore();
    await fileAs(store, reporter, "post", "p_eurth");
    const [strings, key] = store.tx.$executeRaw.mock.calls[0] as never as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
    expect(key).toBe("forum-report:u_r");
    expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      store.tx.forumReport.findFirst.mock.invocationCallOrder[0]!
    );
  });

  it.each(["ab", "  a  ", "x".repeat(1001)])(
    "a reason of 3 to 1000 characters (%#)",
    async (reason) => {
      const store = reportsStore();
      await expect(fileAs(store, reporter, "post", "p_eurth", reason)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  );

  it.each([
    ["a hidden thread", "thread", "t_hidden"],
    ["a hidden post", "post", "p_hidden"],
    ["another member's Reports thread", "thread", "t_report"],
    ["a thread in a draft realm", "thread", "t_draft"],
    ["a missing post", "post", "nope"],
    ["a missing thread", "thread", "nope"],
  ] as const)("%s is NOT_FOUND to the reporter", async (_label, targetType, targetId) => {
    const store = reportsStore();
    await expect(fileAs(store, reporter, targetType, targetId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("a moderator may report what only moderators see", async () => {
    const store = reportsStore();
    await fileAs(store, admin, "post", "p_hidden");
    expect(store.state.reports).toHaveLength(1);
  });
});

const report = (
  id: string,
  targetType: string,
  targetId: string,
  categoryId: string,
  extra: Row = {}
): Row => ({
  id,
  targetType,
  targetId,
  categoryId,
  reporterId: "u_r",
  reason: `Reason ${id}`,
  status: "open",
  handledBy: null,
  handledAt: null,
  note: null,
  createdAt: at(1),
  ...extra,
});
const queue = (): Row[] => [
  report("rep_general", "post", "p_general", "cat_general", { createdAt: at(3) }),
  report("rep_eurth", "thread", "t_eurth", "r_eurth_hub", { createdAt: at(2) }),
  report("rep_ixworld", "thread", "t_ixworld", "default_hub", { createdAt: at(1) }),
  report("rep_gone", "post", "p_deleted", "cat_general", { createdAt: at(0) }),
  report("rep_done", "post", "p_eurth", "r_eurth_hub", { status: "resolved", createdAt: at(4) }),
];

describe("listReports", () => {
  it("shows a site admin every open report, newest first, with its target and category", async () => {
    const store = reportsStore([], { reports: queue() });
    const { rows, total } = await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(total).toBe(4);
    expect(rows.map((r) => r.id)).toEqual(["rep_general", "rep_eurth", "rep_ixworld", "rep_gone"]);
    expect(rows[0]).toMatchObject({
      targetType: "post",
      targetId: "p_general",
      threadId: "t_general",
      threadTitle: "Thread t_general",
      excerpt: "x".repeat(160),
      categoryId: "cat_general",
      category: { key: "general", name: "general", realm: null },
      reporterId: "u_r",
      reason: "Reason rep_general",
      status: "open",
    });
    expect(rows[1]).toMatchObject({
      threadId: "t_eurth",
      threadTitle: "Thread t_eurth",
      excerpt: "Thread t_eurth",
      category: { key: "hub", name: "Hub", realm: { slug: "eurth", name: "Eurth" } },
    });
    expect(rows[2]!.category.realm).toEqual({ slug: "ixworld", name: "IxWorld" });
    expect(rows[3]).toMatchObject({ threadId: null, threadTitle: null, excerpt: null });
  });

  it("loads the targets in one thread query and one post query", async () => {
    const store = reportsStore([], { reports: queue() });
    await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(store.db.forumThread.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.forumPost.findMany).toHaveBeenCalledTimes(1);
  });

  it("scopes the queue to what the moderator moderates", async () => {
    const store = reportsStore([], { reports: queue() });
    const eurth = await listReports(store.db as never, eurthMod, { status: "open" }, 1);
    expect(eurth.rows.map((r) => r.id)).toEqual(["rep_eurth"]);
    expect(eurth.total).toBe(1);
    const general = await listReports(store.db as never, generalMod, { status: "open" }, 1);
    expect(general.rows.map((r) => r.id)).toEqual(["rep_general", "rep_gone"]);
  });

  it("filters by status and by realm", async () => {
    const store = reportsStore([], { reports: queue() });
    const resolved = await listReports(store.db as never, eurthMod, { status: "resolved" }, 1);
    expect(resolved.rows.map((r) => r.id)).toEqual(["rep_done"]);
    const oneRealm = await listReports(
      store.db as never,
      admin,
      { status: "open", realmId: "r_eurth" },
      1
    );
    expect(oneRealm.rows.map((r) => r.id)).toEqual(["rep_eurth"]);
  });

  it("is moderators only", async () => {
    const store = reportsStore([], { reports: queue() });
    await expect(
      listReports(store.db as never, member, { status: "open" }, 1)
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listReports(store.db as never, null, { status: "open" }, 1)).rejects.toMatchObject(
      {
        code: "FORBIDDEN",
      }
    );
  });

  it("pages by REPORTS_PER_PAGE", async () => {
    const many = Array.from({ length: REPORTS_PER_PAGE + 2 }, (_, i) =>
      report(`rep_${String(i).padStart(2, "0")}`, "thread", "t_general", "cat_general", {
        createdAt: at(i),
      })
    );
    const store = reportsStore([], { reports: many });
    const second = await listReports(store.db as never, admin, { status: "open" }, 2);
    expect(second.total).toBe(REPORTS_PER_PAGE + 2);
    expect(second.rows.map((r) => r.id)).toEqual(["rep_01", "rep_00"]);
  });
});

describe("resolveReport", () => {
  it("resolves an open report in scope and logs report.resolve through the transaction", async () => {
    const store = reportsStore([], { reports: queue() });
    await resolveReport(store.db as never, eurthMod, {
      reportId: "rep_eurth",
      outcome: "resolved",
      note: " handled ",
    });
    const row = store.state.reports.find((r) => r.id === "rep_eurth")!;
    expect(row).toMatchObject({ status: "resolved", handledBy: "u_eurth", note: "handled" });
    expect(row.handledAt).toBeInstanceOf(Date);
    expect(store.logs).toEqual([
      expect.objectContaining({
        actorId: "u_eurth",
        action: "report.resolve",
        targetType: "report",
        targetId: "rep_eurth",
        scope: "realm",
        scopeId: "r_eurth",
      }),
    ]);
    expect(detailOf(store.logs[0])).toEqual({
      note: "handled",
      targetType: "thread",
      targetId: "t_eurth",
    });
    expect(store.db.forumModLog.create).not.toHaveBeenCalled();
  });

  it("dismisses and logs report.dismiss", async () => {
    const store = reportsStore([], { reports: queue() });
    await resolveReport(store.db as never, generalMod, {
      reportId: "rep_general",
      outcome: "dismissed",
    });
    expect(store.state.reports.find((r) => r.id === "rep_general")).toMatchObject({
      status: "dismissed",
      note: null,
    });
    expect(store.logs[0]).toMatchObject({
      action: "report.dismiss",
      scope: "category",
      scopeId: "cat_general",
    });
  });

  it("a handled report is CONFLICT and logs nothing", async () => {
    const store = reportsStore([], { reports: queue() });
    await expect(
      resolveReport(store.db as never, admin, { reportId: "rep_done", outcome: "dismissed" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await resolveReport(store.db as never, admin, { reportId: "rep_eurth", outcome: "dismissed" });
    await expect(
      resolveReport(store.db as never, admin, { reportId: "rep_eurth", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.logs).toHaveLength(1);
  });

  it("a report handled before the transaction is CONFLICT without opening one", async () => {
    const store = reportsStore([], { reports: queue() });
    await expect(
      resolveReport(store.db as never, admin, { reportId: "rep_done", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.db.$transaction).not.toHaveBeenCalled();
  });

  it("a report handled by someone else meanwhile is CONFLICT and logs nothing", async () => {
    const store = reportsStore([], { reports: queue() });
    const run = store.db.$transaction.getMockImplementation()!;
    store.db.$transaction.mockImplementationOnce(async (fn) => {
      store.state.reports.find((r) => r.id === "rep_eurth")!.status = "dismissed";
      return run(fn);
    });
    await expect(
      resolveReport(store.db as never, admin, { reportId: "rep_eurth", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.state.reports.find((r) => r.id === "rep_eurth")!.status).toBe("dismissed");
    expect(store.logs).toHaveLength(0);
  });

  it("is scoped to the report's category", async () => {
    const store = reportsStore([], { reports: queue() });
    await expect(
      resolveReport(store.db as never, generalMod, { reportId: "rep_eurth", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      resolveReport(store.db as never, member, { reportId: "rep_eurth", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      resolveReport(store.db as never, admin, { reportId: "nope", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.state.reports.find((r) => r.id === "rep_eurth")!.status).toBe("open");
  });

  it("a report whose category is gone is left to site admins, logged at site scope", async () => {
    const orphan = report("rep_orphan", "post", "p_x", "cat_deleted");
    const store = reportsStore([], { reports: [orphan] });
    await expect(
      resolveReport(store.db as never, eurthMod, { reportId: "rep_orphan", outcome: "dismissed" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await resolveReport(store.db as never, admin, { reportId: "rep_orphan", outcome: "dismissed" });
    expect(store.logs[0]).toMatchObject({ scope: "site", scopeId: null });
  });
});
