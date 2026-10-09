/** @jest-environment node */
import { listModLog, LOG_PER_PAGE, logModAction } from "~/server/modules/thinkpages-forum";

const USER_ROLE = { name: "user", level: 100 };
const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const member = { id: "u_p", clerkUserId: "plain", countryId: "c1", role: USER_ROLE };
const realmMod = {
  id: "u_f",
  clerkUserId: "founder",
  countryId: null,
  role: USER_ROLE,
  mod: { siteAdmin: false, realmIds: ["r_eurth", "r_bee"], categoryIds: ["cat_general"] },
};

const createdAt = new Date("2026-10-09T12:00:00Z");

/** Content written by the realm moderator u_f; anything else is someone else's. */
const ownContent = [
  { id: "t_own", authorUserId: "u_f" },
  { id: "p_own", authorUserId: "u_f" },
  { id: "p_other", authorUserId: "u_m" },
];
const authored = jest.fn(
  async ({ where }: { where: { id: { in: string[] }; authorUserId: string } }) =>
    ownContent
      .filter((c) => where.id.in.includes(c.id) && c.authorUserId === where.authorUserId)
      .map((c) => ({ id: c.id }))
);

function logDb(rows: object[] = []) {
  return {
    forumThread: { findMany: authored },
    forumPost: { findMany: authored },
    forumModLog: {
      create: jest.fn(async () => ({ id: "log1" })),
      findMany: jest.fn(async () => rows),
      count: jest.fn(async () => rows.length),
    },
    forumCategory: {
      findMany: jest.fn(async ({ where }: { where: { realmId: string | { in: string[] } } }) =>
        typeof where.realmId === "string"
          ? [{ id: `cat_${where.realmId}_hub` }]
          : where.realmId.in.map((id) => ({ id: `cat_${id}_hub` }))
      ),
    },
  };
}

const row = (detail: string | null) => ({
  id: "log1",
  actorId: "u_a",
  action: "ban.issue",
  targetType: "user",
  targetId: "u_p",
  scope: "realm",
  scopeId: "r_eurth",
  detail,
  createdAt,
});

describe("logModAction (M16)", () => {
  it("writes one row with the scope columns and the detail as JSON", async () => {
    const db = logDb();
    await logModAction(db as never, {
      actorId: "u_a",
      action: "ban.issue",
      targetType: "user",
      targetId: "u_p",
      scope: { kind: "realm", realmId: "r_eurth" },
      detail: { banId: "b1", days: null, reason: "Spam" },
    });
    expect(db.forumModLog.create).toHaveBeenCalledWith({
      data: {
        actorId: "u_a",
        action: "ban.issue",
        targetType: "user",
        targetId: "u_p",
        scope: "realm",
        scopeId: "r_eurth",
        detail: JSON.stringify({ banId: "b1", days: null, reason: "Spam" }),
      },
    });
  });

  it("stores site and category scopes and no detail", async () => {
    const db = logDb();
    const base = { actorId: "u_a", action: "x", targetType: "user", targetId: "u_p" };
    await logModAction(db as never, { ...base, scope: { kind: "site" } });
    await logModAction(db as never, {
      ...base,
      scope: { kind: "category", categoryId: "cat_general" },
    });
    expect(
      db.forumModLog.create.mock.calls.map((c) => (c as never as [{ data: object }])[0].data)
    ).toEqual([
      expect.objectContaining({ scope: "site", scopeId: null, detail: null }),
      expect.objectContaining({ scope: "category", scopeId: "cat_general", detail: null }),
    ]);
  });
});

describe("listModLog", () => {
  const reportRow = (action: string, targetType: string, targetId: string) => ({
    ...row(JSON.stringify({ note: "Flagged by the usual suspect", targetType, targetId })),
    id: `log_${targetId}`,
    action,
    targetType: "report",
    targetId: `rep_${targetId}`,
    scope: "category",
    scopeId: "cat_general",
  });
  const reportRows = () => [
    reportRow("report.resolve", "post", "p_own"),
    reportRow("report.dismiss", "thread", "t_own"),
    reportRow("report.resolve", "post", "p_other"),
  ];
  const notes = (result: Awaited<ReturnType<typeof listModLog>>) =>
    result.rows.map((r) => r.detail?.note ?? null);

  it("withholds the handler's note from a moderator on report rows about their own content", async () => {
    authored.mockClear();
    const result = await listModLog(logDb(reportRows()) as never, realmMod, {}, 1);
    expect(notes(result)).toEqual([null, null, "Flagged by the usual suspect"]);
    expect(result.rows[0]!.detail).toEqual({ note: null, targetType: "post", targetId: "p_own" });
    expect(authored).toHaveBeenCalledTimes(2);
  });

  it("keeps every note for site admins, with no authorship lookups", async () => {
    authored.mockClear();
    const result = await listModLog(logDb(reportRows()) as never, admin, {}, 1);
    expect(notes(result)).toEqual(Array(3).fill("Flagged by the usual suspect"));
    expect(authored).not.toHaveBeenCalled();
  });

  it("looks up no authorship when the page has no report rows", async () => {
    authored.mockClear();
    await listModLog(logDb([row(null)]) as never, realmMod, {}, 1);
    expect(authored).not.toHaveBeenCalled();
  });

  it("refuses members", async () => {
    await expect(listModLog(logDb() as never, member, {}, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listModLog(logDb() as never, null, {}, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("shows site admins everything, newest first, a page at a time", async () => {
    const db = logDb([row(null)]);
    const result = await listModLog(db as never, admin, {}, 3);
    expect(db.forumModLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      skip: 2 * LOG_PER_PAGE,
      take: LOG_PER_PAGE,
    });
    expect(db.forumModLog.count).toHaveBeenCalledWith({ where: {} });
    expect(result.total).toBe(1);
    expect(LOG_PER_PAGE).toBe(50);
  });

  it("filters a site admin's log by realm: the realm's rows and its categories' rows", async () => {
    const db = logDb();
    await listModLog(db as never, admin, { realmId: "r_bee" }, 1);
    expect(db.forumModLog.findMany.mock.calls[0]).toEqual([
      expect.objectContaining({
        where: {
          OR: [
            { scope: "realm", scopeId: { in: ["r_bee"] } },
            { scope: "category", scopeId: { in: ["cat_r_bee_hub"] } },
          ],
        },
      }),
    ]);
  });

  it("shows other moderators their realms' rows and their categories' rows only", async () => {
    const db = logDb();
    await listModLog(db as never, realmMod, {}, 1);
    expect(db.forumModLog.findMany.mock.calls[0]).toEqual([
      expect.objectContaining({
        where: {
          OR: [
            { scope: "realm", scopeId: { in: ["r_eurth", "r_bee"] } },
            {
              scope: "category",
              scopeId: { in: ["cat_r_eurth_hub", "cat_r_bee_hub", "cat_general"] },
            },
          ],
        },
      }),
    ]);
  });

  it("narrows a moderator's realm filter to their own scope", async () => {
    const db = logDb();
    await listModLog(db as never, realmMod, { realmId: "r_bee" }, 1);
    await listModLog(db as never, realmMod, { realmId: "r_other" }, 1);
    expect(
      db.forumModLog.findMany.mock.calls.map((c) => (c as never as [{ where: object }])[0].where)
    ).toEqual([
      {
        OR: [
          { scope: "realm", scopeId: { in: ["r_bee"] } },
          { scope: "category", scopeId: { in: ["cat_r_bee_hub"] } },
        ],
      },
      {
        OR: [
          { scope: "realm", scopeId: { in: [] } },
          { scope: "category", scopeId: { in: [] } },
        ],
      },
    ]);
  });

  it("parses detail into flat values and drops anything else", async () => {
    const db = logDb([
      row(JSON.stringify({ banId: "b1", days: 7, auto: false, note: null })),
      row("not json"),
      row(JSON.stringify({ nested: { a: 1 } })),
      row(JSON.stringify([1, 2])),
      row(null),
    ]);
    const { rows } = await listModLog(db as never, admin, {}, 1);
    expect(rows.map((r) => r.detail)).toEqual([
      { banId: "b1", days: 7, auto: false, note: null },
      null,
      null,
      null,
      null,
    ]);
    expect(rows[0]).toMatchObject({ id: "log1", scope: "realm", scopeId: "r_eurth", createdAt });
  });
});
