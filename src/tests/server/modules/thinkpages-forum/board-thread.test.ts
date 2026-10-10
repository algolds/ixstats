/** @jest-environment node */
import { boardThreadOf } from "~/server/modules/thinkpages-forum/board-thread";

describe("boardThreadOf", () => {
  it("finds the realm's one board thread through its board category", async () => {
    const findFirst = jest.fn(async (_args: object) => ({ id: "t_board", categoryId: "c_board" }));
    const out = await boardThreadOf({ forumThread: { findFirst } } as never, "r1");
    expect(out).toEqual({ categoryId: "c_board", threadId: "t_board" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: { scope: "realm", realmId: "r1", key: "board" } } })
    );
  });

  it("is null, creating nothing, when the realm has no board", async () => {
    const create = jest.fn();
    const createMany = jest.fn();
    const findFirst = jest.fn(async () => null);
    const out = await boardThreadOf({ forumThread: { findFirst, create, createMany } } as never, "r1");
    expect(out).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});
