/** @jest-environment node */
/**
 * I5: the stash page lists a stashed native forum thread under its current title, and leaves out one its owner can
 * no longer read (hidden, staff-only or gone), whatever title the stash note kept from stash time.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    stashItem: { findMany: jest.fn() },
    forumThread: { findMany: jest.fn() },
    realm: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const general = { id: "cat_general", scope: "site", realmId: null, visibility: "public" };
const staff = { id: "cat_staff", scope: "site", realmId: null, visibility: "staff" };
const thread = (id: string, extra: object = {}) => ({
  id,
  title: `Now ${id}`,
  authorUserId: "u_other",
  hidden: false,
  category: general,
  ...extra,
});
const item = (pageTitle: string, note: string | null) => ({
  id: `i_${pageTitle}`,
  pageTitle,
  pageSlug: "/x",
  note,
  contentType: null,
  contentId: null,
  annotations: [],
  _count: { annotations: 0 },
  savedAt: new Date("2026-10-01T00:00:00Z"),
});

const caller = () =>
  createCallerFactory(wikiosStashRouter)(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
    }) as never
  );

describe("getStashItems and stashed forum threads (I5)", () => {
  it("re-titles readable native threads, drops unreadable ones and leaves other items alone", async () => {
    jest
      .mocked(db.stashItem.findMany)
      .mockResolvedValue([
        item("Main_Page", "a wiki note"),
        item("thinkpages:thread:t_ok", "Old title"),
        item("thinkpages:thread:t_hidden", "Hidden title"),
        item("thinkpages:thread:t_staff", "Staff title"),
        item("thinkpages:thread:t_gone", "Gone title"),
      ] as never);
    jest
      .mocked(db.forumThread.findMany)
      .mockResolvedValue([
        thread("t_ok"),
        thread("t_hidden", { hidden: true }),
        thread("t_staff", { category: staff }),
      ] as never);

    const { items } = await caller().getStashItems({ stashId: "s1" });

    expect(items.map((i) => [i.pageTitle, i.note])).toEqual([
      ["Main_Page", "a wiki note"],
      ["thinkpages:thread:t_ok", "Now t_ok"],
    ]);
  });

  it("asks nothing of the forum when the page holds no native thread", async () => {
    jest.mocked(db.forumThread.findMany).mockClear();
    jest.mocked(db.stashItem.findMany).mockResolvedValue([item("Main_Page", null)] as never);
    await caller().getStashItems({ stashId: "s1" });
    expect(db.forumThread.findMany).not.toHaveBeenCalled();
  });
});
