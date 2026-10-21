/** @jest-environment node */
import { listAppeals } from "~/server/modules/thinkpages-forum";
import { appeal, bans, days, NOW, warnings } from "~/tests/helpers/forum-appeal-fixtures";
import {
  admin,
  admin2,
  categories,
  eurthMod,
  generalMod,
  member,
  moderatorOf,
  realms,
  users,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const eurthMod2 = moderatorOf("u_eurth2", ["r_eurth"]);
const auroraMod = moderatorOf("u_aur", ["r_aurora"]);

const appeals: Row[] = [
  appeal("a_realm", "ban", "b_realm"),
  appeal("a_site", "ban", "b_site"),
  appeal("a_auto", "ban", "b_auto"),
  appeal("a_cat", "ban", "b_cat"),
  appeal("a_weurth", "warning", "w_eurth"),
  appeal("a_wsite", "warning", "w_site"),
  appeal("a_wgeneral", "warning", "w_general"),
  appeal("a_done", "ban", "b_lifted", {
    status: "overturned",
    reviewedBy: "u_eurth2",
    reviewedAt: days(-0.5),
    response: "Lifted.",
  }),
];
const raisedAuto: Row = {
  actorId: "u_a2",
  action: "ban.extend",
  targetType: "user",
  targetId: "u_m",
  scope: "site",
  scopeId: null,
  detail: JSON.stringify({ banId: "b_auto", autoTier: 10 }),
};

const storeWith = (extra: { appeals?: Row[]; logs?: Row[] } = {}) =>
  forumStore({ categories, realms, users, bans, warnings, appeals, ...extra });
const idsOf = (result: { rows: Array<{ id: string }> }) => result.rows.map((r) => r.id).sort();

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("listAppeals", () => {
  it.each([
    ["a member", member],
    ["a signed-out viewer", null],
  ] as const)("refuses %s (FORBIDDEN)", async (_case, viewer) => {
    const store = storeWith();
    await expect(
      listAppeals(store.db as never, viewer, { status: "open" }, 1)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("lists moot appeals as closed: their own status, never reviewable", async () => {
    const store = storeWith({
      appeals: [
        ...appeals,
        appeal("a_moot", "ban", "b_expired", { status: "moot", reviewedAt: days(-0.5) }),
      ],
    });
    const result = await listAppeals(store.db as never, admin, { status: "moot" }, 1);
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: "a_moot",
        status: "moot",
        canReview: false,
        subject: expect.objectContaining({ active: false }),
      }),
    ]);
  });

  it("gives a realm moderator the appeals on their realm's bans and its categories' warnings only", async () => {
    const store = storeWith();
    const result = await listAppeals(store.db as never, eurthMod2, { status: "open" }, 1);
    expect(idsOf(result)).toEqual(["a_realm", "a_weurth"]);
    expect(result.total).toBe(2);
  });

  it("filters a scoped queue by the appeals' own scope, never reading every appeal of a status (M7)", async () => {
    const store = storeWith();
    await listAppeals(store.db as never, eurthMod2, { status: "open" }, 1);
    expect(store.db.forumAppeal.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.forumAppeal.findMany.mock.calls[0]![0]!.where).toEqual({
      status: "open",
      OR: [
        { scope: "realm", scopeId: { in: ["r_eurth"] } },
        { scope: "category", scopeId: { in: expect.arrayContaining(["r_eurth_hub"]) } },
      ],
    });
  });

  it("gives a category moderator the appeals on their category's bans and warnings only", async () => {
    const store = storeWith();
    const result = await listAppeals(store.db as never, generalMod, { status: "open" }, 1);
    expect(idsOf(result)).toEqual(["a_cat", "a_wgeneral"]);
  });

  it("gives another realm's moderator nothing of Eurth's", async () => {
    const store = storeWith();
    const result = await listAppeals(store.db as never, auroraMod, { status: "open" }, 1);
    expect(result).toEqual({ rows: [], total: 0 });
  });
  it("marks what the viewer may review: never their own subject, an automatic ban they raised, or their own appeal", async () => {
    const store = storeWith({ logs: [raisedAuto] });
    const byId = async (viewer: Parameters<typeof listAppeals>[1]) => {
      const result = await listAppeals(store.db as never, viewer, { status: "open" }, 1);
      return Object.fromEntries(result.rows.map((r) => [r.id, r.canReview]));
    };
    expect(await byId(admin)).toMatchObject({
      a_site: false,
      a_auto: false,
      a_wsite: false,
      a_wgeneral: false,
      a_realm: true,
      a_cat: true,
      a_weurth: true,
    });
    expect(await byId(admin2)).toMatchObject({ a_site: true, a_auto: false, a_wsite: true });
    expect(await byId(eurthMod)).toEqual({ a_realm: false, a_weurth: false });
    expect(await byId(eurthMod2)).toEqual({ a_realm: true, a_weurth: true });
    const promoted = { ...moderatorOf("u_m", ["r_eurth"]), clerkUserId: "member" };
    expect(await byId(promoted)).toEqual({ a_realm: false, a_weurth: false });
  });
});
