/** @jest-environment node */
import { myStanding } from "~/server/modules/thinkpages-forum";
import {
  appeal,
  ban,
  bans,
  days,
  NOW,
  warning,
  warnings,
} from "~/tests/helpers/forum-appeal-fixtures";
import { categories, member, realms, users } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const storeWith = (extra: { appeals?: Row[]; bans?: Row[]; warnings?: Row[] } = {}) =>
  forumStore({ categories, realms, users, bans, warnings, ...extra });

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("myStanding", () => {
  it("never names a category the member cannot see (M14)", async () => {
    const staff: Row = {
      ...categories[0]!,
      id: "cat_staff",
      key: "staff",
      name: "Staff",
      visibility: "staff",
    };
    const reports = categories.find((c) => c.id === "cat_reports")!;
    const store = forumStore({
      categories: [...categories, staff],
      realms,
      users,
      warnings,
      bans: [
        ban("b_staff", { scope: "category", scopeId: "cat_staff" }),
        ban("b_reports", { scope: "category", scopeId: reports.id as string }),
      ],
    });
    const standing = await myStanding(store.db as never, member);
    const byId = Object.fromEntries(standing.bans.map((b) => [b.id, b]));
    expect(byId.b_staff).toMatchObject({ scope: "category", scopeName: null });
    expect(byId.b_reports).toMatchObject({ scopeName: "reports" });
  });

  it("shows each item's appeal and only offers an appeal where none was filed", async () => {
    const store = storeWith({
      appeals: [
        appeal("a_ban", "ban", "b_realm", {
          status: "upheld",
          reviewedBy: "u_eurth2",
          reviewedAt: days(-0.5),
          response: "It stands.",
        }),
        appeal("a_warn", "warning", "w_eurth"),
      ],
    });
    const standing = await myStanding(store.db as never, member);
    const banRow = standing.bans.find((b) => b.id === "b_realm");
    expect(banRow).toMatchObject({
      canAppeal: false,
      appeal: { id: "a_ban", status: "upheld", response: "It stands.", reviewedAt: days(-0.5) },
    });
    expect(standing.warnings.find((w) => w.id === "w_eurth")).toMatchObject({
      canAppeal: false,
      appeal: { id: "a_warn", status: "open", response: null },
    });
    expect(standing.bans.find((b) => b.id === "b_site")).toMatchObject({ canAppeal: true });
  });

  it("finds the appeal of a long-running ban however old it is", async () => {
    const store = storeWith({
      bans: [ban("b_perm", { expiresAt: null, createdAt: days(-200) })],
      warnings: [],
      appeals: [appeal("a_old", "ban", "b_perm", { status: "upheld", createdAt: days(-190) })],
    });
    const standing = await myStanding(store.db as never, member);
    expect(standing.bans[0]).toMatchObject({ canAppeal: false, appeal: { status: "upheld" } });
    // The item carries its old decision; the recent-appeals list does not repeat it.
    expect(standing.appeals).toEqual([]);
  });
  it("shows a moot appeal as closed: on its item, which can't be appealed again, and in the list", async () => {
    const store = storeWith({
      appeals: [appeal("a_moot", "warning", "w_revoked", { status: "moot", reviewedAt: days(-1) })],
    });
    const standing = await myStanding(store.db as never, member);
    expect(standing.warnings.find((w) => w.id === "w_revoked")).toMatchObject({
      canAppeal: false,
      appeal: { id: "a_moot", status: "moot", reviewedAt: days(-1) },
    });
    expect(standing.appeals).toEqual([expect.objectContaining({ id: "a_moot", status: "moot" })]);
  });

  it("never returns who issued, lifted, revoked or reviewed anything", async () => {
    const store = storeWith({
      appeals: [appeal("a_ban", "ban", "b_realm", { status: "upheld", reviewedBy: "u_eurth2" })],
      warnings: [...warnings, warning("w_by_mod", { issuedBy: "u_secret_mod" })],
    });
    const json = JSON.stringify(await myStanding(store.db as never, member));
    for (const leak of [
      "issuedBy",
      "liftedBy",
      "revokedBy",
      "reviewedBy",
      "u_eurth",
      'u_a"',
      "u_secret_mod",
    ]) {
      expect(json).not.toContain(leak);
    }
  });

  it("only reads the member's own rows", async () => {
    const store = storeWith();
    const standing = await myStanding(store.db as never, member);
    expect(standing.bans.map((b) => b.id)).not.toContain("b_other");
    for (const delegate of [store.db.forumWarning, store.db.forumBan, store.db.forumAppeal]) {
      for (const [args] of delegate.findMany.mock.calls) {
        expect(args).toMatchObject({ where: { userId: "u_m" } });
      }
    }
  });
});
