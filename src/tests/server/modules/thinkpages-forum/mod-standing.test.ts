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
  it("adds up the member's active points", async () => {
    const standing = await myStanding(storeWith().db as never, member);
    expect(standing.activePoints).toBe(7);
  });

  it("lists warnings from the last 90 days, revoked ones included, newest first by query", async () => {
    const store = storeWith();
    const standing = await myStanding(store.db as never, member);
    expect(standing.warnings.map((w) => w.id).sort()).toEqual(
      ["w_eurth", "w_general", "w_revoked", "w_site"].sort()
    );
    expect(store.db.forumWarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
    expect(standing.warnings.find((w) => w.id === "w_site")).toEqual({
      id: "w_site",
      points: 3,
      reason: "Rude",
      createdAt: days(-10),
      expiresAt: days(80),
      revokedAt: null,
      appeal: null,
      canAppeal: true,
    });
    expect(standing.warnings.find((w) => w.id === "w_revoked")).toMatchObject({
      revokedAt: days(-1),
      canAppeal: false,
    });
  });

  it("lists active bans only, with the place's name", async () => {
    const store = storeWith({
      bans: [
        ...bans,
        ban("b_ixworld", { scopeId: "default" }),
        ban("b_gone", { scope: "category", scopeId: "cat_gone" }),
      ],
    });
    const standing = await myStanding(store.db as never, member);
    const byId = Object.fromEntries(standing.bans.map((b) => [b.id, b]));
    expect(Object.keys(byId).sort()).toEqual(
      ["b_auto", "b_cat", "b_gone", "b_ixworld", "b_realm", "b_site"].sort()
    );
    expect(byId.b_realm).toEqual({
      id: "b_realm",
      scope: "realm",
      scopeName: "Eurth",
      reason: "Spam",
      expiresAt: days(5),
      auto: false,
      appeal: null,
      canAppeal: true,
    });
    expect(byId.b_cat).toMatchObject({ scope: "category", scopeName: "general" });
    expect(byId.b_site).toMatchObject({ scope: "site", scopeName: null, expiresAt: null });
    expect(byId.b_auto).toMatchObject({ scope: "site", auto: true });
    expect(byId.b_ixworld).toMatchObject({ scopeName: "IxWorld" });
    expect(byId.b_gone).toMatchObject({ scopeName: null });
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

  it("lists the member's open and recent appeals, overturned ones whose ban is gone included", async () => {
    const store = storeWith({
      appeals: [
        appeal("a_done", "ban", "b_lifted", {
          status: "overturned",
          reviewedAt: days(-0.5),
          response: "Lifted.",
        }),
        appeal("a_ancient", "warning", "w_expired", { status: "upheld", createdAt: days(-95) }),
        appeal("a_theirs", "ban", "b_other", { userId: "u_o" }),
      ],
    });
    const standing = await myStanding(store.db as never, member);
    expect(standing.appeals).toEqual([
      {
        id: "a_done",
        subjectType: "ban",
        subjectId: "b_lifted",
        status: "overturned",
        response: "Lifted.",
        createdAt: days(-1),
        reviewedAt: days(-0.5),
      },
    ]);
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
