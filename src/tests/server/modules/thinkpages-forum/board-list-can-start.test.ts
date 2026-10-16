/** @jest-environment node */
import { forumStore } from "~/tests/helpers/forum-store-fake";
import {
  admin,
  categories,
  member,
  seed,
  site,
  type Row,
} from "~/tests/helpers/forum-mod-fixtures";
import { listBoards } from "~/server/modules/thinkpages-forum/board-list";

/** The fake store has no `groupBy`; the counts are not under test, so every board reports none. */
function dbWithStaffBoard(bans: Row[] = []) {
  const store = forumStore({
    ...seed(),
    bans,
    categories: [...categories, site("cat_rules", "rules", { postRole: "staff" })],
  });
  return {
    ...store.db,
    forumThread: { ...store.db.forumThread, groupBy: jest.fn(async () => []) },
  } as never;
}

const NOW = new Date("2026-10-16T12:00:00Z");
const DAY = 86_400_000;
const ban = (extra: Row = {}): Row => ({
  id: "b1",
  userId: "u_m",
  scope: "site",
  scopeId: null,
  reason: "Spam",
  expiresAt: null,
  liftedAt: null,
  ...extra,
});

describe("listBoards: canStart", () => {
  it("tells each board whether the viewer may start a thread in it", async () => {
    const boards = await listBoards(dbWithStaffBoard(), member);
    expect(boards.find((b) => b.key === "general")?.canStart).toBe(true);
    expect(boards.find((b) => b.key === "rules")?.canStart).toBe(false);
  });

  it("lets a site admin start a thread in a staff-only board", async () => {
    const boards = await listBoards(dbWithStaffBoard(), admin);
    expect(boards.find((b) => b.key === "rules")?.canStart).toBe(true);
  });

  it("never offers Find a Realm, which takes adverts only, to a member or an admin", async () => {
    for (const viewer of [member, admin]) {
      const boards = await listBoards(dbWithStaffBoard(), viewer);
      const find = boards.find((b) => b.key === "find-a-realm");
      expect(find).toBeDefined();
      expect(find?.canStart).toBe(false);
    }
  });

  it("lets no one start a thread when signed out", async () => {
    const boards = await listBoards(dbWithStaffBoard(), null);
    expect(boards.length).toBeGreaterThan(0);
    expect(boards.every((b) => !b.canStart)).toBe(true);
  });
});

describe("listBoards: canStart and bans", () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  const startable = (boards: Awaited<ReturnType<typeof listBoards>>) =>
    boards.filter((b) => b.canStart).map((b) => b.key);

  it("closes every board to a member under a site ban", async () => {
    const open = await listBoards(dbWithStaffBoard(), member);
    expect(startable(open)).toContain("general");
    const boards = await listBoards(dbWithStaffBoard([ban()]), member);
    expect(boards.length).toBe(open.length);
    expect(startable(boards)).toEqual([]);
  });

  it("closes only the board a category ban names", async () => {
    const open = startable(await listBoards(dbWithStaffBoard(), member));
    const boards = await listBoards(
      dbWithStaffBoard([ban({ scope: "category", scopeId: "cat_general" })]),
      member
    );
    expect(startable(boards)).toEqual(open.filter((key) => key !== "general"));
  });

  it("ignores a ban on another member, on a realm, and on a realm board", async () => {
    const open = startable(await listBoards(dbWithStaffBoard(), member));
    const bans = [
      ban({ id: "b2", userId: "u_other" }),
      ban({ id: "b3", scope: "realm", scopeId: "r_eurth" }),
      ban({ id: "b4", scope: "category", scopeId: "r_eurth_hub" }),
    ];
    expect(startable(await listBoards(dbWithStaffBoard(bans), member))).toEqual(open);
  });

  it("ignores an expired ban and a lifted one, and honours one still running", async () => {
    const open = startable(await listBoards(dbWithStaffBoard(), member));
    const spent = [
      ban({ id: "b2", expiresAt: new Date(NOW.getTime() - DAY) }),
      ban({ id: "b3", liftedAt: new Date(NOW.getTime() - DAY) }),
    ];
    expect(startable(await listBoards(dbWithStaffBoard(spent), member))).toEqual(open);
    const running = [ban({ expiresAt: new Date(NOW.getTime() + DAY) })];
    expect(startable(await listBoards(dbWithStaffBoard(running), member))).toEqual([]);
  });

  it("asks the ban table once for a member", async () => {
    const db = dbWithStaffBoard([ban()]) as unknown as ReturnType<typeof forumStore>["db"];
    await listBoards(db as never, member);
    expect(db.forumBan.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale ban row bind a site admin, and spends no ban query on one", async () => {
    const db = dbWithStaffBoard([ban({ userId: "u_a" })]) as unknown as ReturnType<
      typeof forumStore
    >["db"];
    const boards = await listBoards(db as never, admin);
    expect(boards.find((b) => b.key === "general")?.canStart).toBe(true);
    expect(db.forumBan.findMany).not.toHaveBeenCalled();
  });

  it("spends no ban query when signed out", async () => {
    const db = dbWithStaffBoard([ban()]) as unknown as ReturnType<typeof forumStore>["db"];
    await listBoards(db as never, null);
    expect(db.forumBan.findMany).not.toHaveBeenCalled();
  });
});
