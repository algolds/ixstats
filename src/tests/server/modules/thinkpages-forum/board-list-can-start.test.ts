/** @jest-environment node */
import { forumStore } from "~/tests/helpers/forum-store-fake";
import { admin, categories, member, seed, site } from "~/tests/helpers/forum-mod-fixtures";
import { listBoards } from "~/server/modules/thinkpages-forum/board-list";

/** The fake store has no `groupBy`; the counts are not under test, so every board reports none. */
function dbWithStaffBoard() {
  const store = forumStore({
    ...seed(),
    categories: [...categories, site("cat_rules", "rules", { postRole: "staff" })],
  });
  return {
    ...store.db,
    forumThread: { ...store.db.forumThread, groupBy: jest.fn(async () => []) },
  } as never;
}

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

  it("lets no one start a thread when signed out", async () => {
    const boards = await listBoards(dbWithStaffBoard(), null);
    expect(boards.every((b) => !b.canStart)).toBe(true);
  });
});
