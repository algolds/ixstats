/** @jest-environment node */
import { fileReport, listReports, resolveReport } from "~/server/modules/thinkpages-forum";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";
import { forumStore, type Row } from "~/tests/helpers/forum-store-fake";

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
/** A non-admin an admin appointed on the staff-only category: they moderate it but can't read it (M8). */
const staffMod = moderatorOf("u_staffmod", [], ["cat_staff", "cat_general"]);

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
  category("cat_staff", "staff", "site", null, "staff"),
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
    thread("t_ixnay", "default_hub"),
    thread("t_staff", "cat_staff"),
  ],
  posts: [
    post("p_general", "t_general", { plainText: "x".repeat(300) }),
    post("p_eurth", "t_eurth"),
    post("p_hidden", "t_eurth", { hidden: true }),
    post("p_mine", "t_eurth", { authorUserId: "u_r" }),
    post("p_by_mod", "t_eurth", { authorUserId: "u_eurth" }),
    post("p_by_admin", "t_eurth", { authorUserId: "u_a" }),
    post("p_staff", "t_staff"),
  ],
  // Authors as `assertCanModerateAuthor` and the queue's flags read them; u_eurth holds Eurth's board office.
  users: [
    { id: "u_a", clerkUserId: "admin", role: admin.role },
    { id: "u_m", clerkUserId: "member", role: USER_ROLE },
    { id: "u_r", clerkUserId: "reporter", role: USER_ROLE },
    { id: "u_eurth", clerkUserId: "u_eurth", role: USER_ROLE },
  ],
  officers: [{ realmId: "r_eurth", userId: "u_eurth", powers: ["board"] }],
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
    ["another member's Reports thread", "thread", "t_report"],
    ["a thread in a draft realm", "thread", "t_draft"],
  ] as const)("%s is NOT_FOUND to the reporter", async (_label, targetType, targetId) => {
    const store = reportsStore();
    await expect(fileAs(store, reporter, targetType, targetId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
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
  report("rep_ixnay", "thread", "t_ixnay", "default_hub", { createdAt: at(1) }),
  report("rep_gone", "post", "p_deleted", "cat_general", { createdAt: at(0) }),
  report("rep_done", "post", "p_eurth", "r_eurth_hub", { status: "resolved", createdAt: at(4) }),
];

describe("listReports", () => {
  it("scopes the queue to what the moderator moderates", async () => {
    const store = reportsStore([], { reports: queue() });
    const eurth = await listReports(store.db as never, eurthMod, { status: "open" }, 1);
    expect(eurth.rows.map((r) => r.id)).toEqual(["rep_eurth"]);
    expect(eurth.total).toBe(1);
    const general = await listReports(store.db as never, generalMod, { status: "open" }, 1);
    expect(general.rows.map((r) => r.id)).toEqual(["rep_general", "rep_gone"]);
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
});

describe("reports in a category the handler can't read (M8)", () => {
  const staffQueue = (): Row[] => [
    ...queue(),
    report("rep_staff", "post", "p_staff", "cat_staff", { createdAt: at(9) }),
  ];

  it("are left out of a non-admin category moderator's queue, rows and total", async () => {
    const store = reportsStore([], { reports: staffQueue() });
    const { rows, total } = await listReports(store.db as never, staffMod, { status: "open" }, 1);
    expect(rows.map((r) => r.id)).toEqual(["rep_general", "rep_gone"]);
    expect(total).toBe(2);
  });
  it("can't be resolved or dismissed by that moderator; a site admin can", async () => {
    const store = reportsStore([], { reports: staffQueue() });
    for (const outcome of ["resolved", "dismissed"] as const) {
      await expect(
        resolveReport(store.db as never, staffMod, { reportId: "rep_staff", outcome })
      ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Report not found." });
    }
    expect(store.logs).toEqual([]);
    await resolveReport(store.db as never, admin, { reportId: "rep_staff", outcome: "resolved" });
    expect(store.logs).toHaveLength(1);
  });
});
describe("resolveReport", () => {
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
});

describe("reports about the moderator's own content", () => {
  const ownQueue = (): Row[] => [
    ...queue(),
    // The target's author as fileReport stores it (M8).
    report("rep_on_mod", "post", "p_by_mod", "r_eurth_hub", {
      createdAt: at(5),
      targetAuthorId: "u_eurth",
    }),
    report("rep_on_mod_thread", "thread", "t_by_mod", "r_eurth_hub", {
      createdAt: at(6),
      targetAuthorId: "u_eurth",
    }),
    report("rep_on_admin", "post", "p_by_admin", "r_eurth_hub", {
      createdAt: at(7),
      targetAuthorId: "u_a",
    }),
  ];
  const ownStore = () => {
    const store = reportsStore([], { reports: ownQueue() });
    store.state.threads.push({
      id: "t_by_mod",
      categoryId: "r_eurth_hub",
      title: "Mod thread",
      authorUserId: "u_eurth",
      hidden: false,
    });
    return store;
  };

  it("are left out of a moderator's queue, rows and total, so the reporter never reaches them", async () => {
    const store = ownStore();
    const { rows, total } = await listReports(store.db as never, eurthMod, { status: "open" }, 1);
    expect(rows.map((r) => r.id)).toEqual(["rep_on_admin", "rep_eurth"]);
    expect(total).toBe(2);
    expect(rows.every((r) => r.reporterId === "u_r" && !r.ownTarget)).toBe(true);
  });

  it("a site admin sees them all, but their own content's reports without the reporter", async () => {
    const store = ownStore();
    const { rows, total } = await listReports(store.db as never, admin, { status: "open" }, 1);
    expect(total).toBe(7);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("rep_on_admin")).toMatchObject({ ownTarget: true, reporterId: null });
    expect(byId.get("rep_on_mod")).toMatchObject({ ownTarget: false, reporterId: "u_r" });
    expect(byId.get("rep_on_mod_thread")).toMatchObject({ ownTarget: false, reporterId: "u_r" });
  });
  it("a moderator can't resolve or dismiss a report on their own post or thread", async () => {
    const store = ownStore();
    for (const reportId of ["rep_on_mod", "rep_on_mod_thread"]) {
      await expect(
        resolveReport(store.db as never, eurthMod, { reportId, outcome: "dismissed" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(store.logs).toHaveLength(0);
    await resolveReport(store.db as never, admin, { reportId: "rep_on_mod", outcome: "resolved" });
    expect(store.logs).toHaveLength(1);
  });
  it("a realm moderator can't resolve or dismiss a report on a site admin's post (M-3)", async () => {
    const store = ownStore();
    await expect(
      resolveReport(store.db as never, eurthMod, { reportId: "rep_on_admin", outcome: "dismissed" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only site admins moderate a site admin's posts.",
    });
    expect(store.state.reports.find((r) => r.id === "rep_on_admin")!.status).toBe("open");
    expect(store.logs).toHaveLength(0);
  });
  it("a report re-pointed by a move after the scope check is CONFLICT", async () => {
    const store = ownStore();
    const run = store.db.$transaction.getMockImplementation()!;
    store.db.$transaction.mockImplementationOnce(async (fn) => {
      store.state.reports.find((r) => r.id === "rep_general")!.categoryId = "r_eurth_hub";
      return run(fn);
    });
    await expect(
      resolveReport(store.db as never, generalMod, { reportId: "rep_general", outcome: "resolved" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.logs).toHaveLength(0);
  });
});

describe("reports on imported content without an IxStats author", () => {
  const importedReports = (): Row[] => [
    report("rep_imported_post", "post", "p_imported", "r_eurth_hub", { createdAt: at(8) }),
    report("rep_imported_thread", "thread", "t_imported", "r_eurth_hub", { createdAt: at(9) }),
  ];
  const importedStore = (reports = importedReports()) => {
    const store = reportsStore([], { reports });
    store.state.threads.push(
      thread("t_imported", "r_eurth_hub", { authorUserId: null, importedAuthorName: "OldThread" })
    );
    store.state.posts.push(
      post("p_imported", "t_eurth", { authorUserId: null, importedAuthorName: "OldName" })
    );
    return store;
  };
  it("queue as hideable, never sanctionable, with no author, and never ask for a null user", async () => {
    const store = importedStore();
    const { rows } = await listReports(store.db as never, eurthMod, { status: "open" }, 1);
    expect(
      rows.map(({ id, moderable, sanctionable, targetAuthorId, targetImportedAuthorName }) => ({
        id,
        moderable,
        sanctionable,
        targetAuthorId,
        targetImportedAuthorName,
      }))
    ).toEqual([
      {
        id: "rep_imported_thread",
        moderable: true,
        sanctionable: false,
        targetAuthorId: null,
        targetImportedAuthorName: "OldThread",
      },
      {
        id: "rep_imported_post",
        moderable: true,
        sanctionable: false,
        targetAuthorId: null,
        targetImportedAuthorName: "OldName",
      },
    ]);
    for (const delegate of [store.db.forumThread, store.db.forumPost]) {
      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.objectContaining({ importedAuthorName: true }) })
      );
    }
    for (const [args] of store.db.user.findMany.mock.calls as Array<[{ where: Row }]>) {
      expect(JSON.stringify(args.where)).not.toContain("null");
    }
  });
});
