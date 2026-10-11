/** @jest-environment node */
jest.mock("~/server/modules/action-links", () => ({
  ...jest.requireActual("~/server/modules/action-links"),
  validatePostActionTokens: jest.fn(async () => ["a1"]),
  syncPostActionLinks: jest.fn(async () => ({ created: ["a1"] })),
}));
jest.mock("~/server/modules/thinkpages-forum/action-reward", () => ({
  rewardNewLinks: jest.fn(async () => ({ amount: 5 })),
}));

import { rewardNewLinks } from "~/server/modules/thinkpages-forum/action-reward";
import { postBoardMessage } from "~/server/modules/thinkpages-forum/board-writes";
import { boardStore, member } from "~/tests/helpers/forum-board-fake";

describe("postBoardMessage reward", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the stored message and the reward for its new links", async () => {
    const store = boardStore();
    const out = await postBoardMessage(store.db as never, member as never, {
      realm: "eurth",
      html: "<p>see [ixaction=a1]</p>",
    });
    expect(out.reward).toEqual({ amount: 5 });
    expect(out.message).toMatchObject({ byViewer: true });
    expect(rewardNewLinks).toHaveBeenCalledWith(store.db, member, out.message.id, ["a1"]);
  });

  it("returns no reward when the step finds none", async () => {
    jest.mocked(rewardNewLinks).mockResolvedValueOnce(null);
    const out = await postBoardMessage(boardStore().db as never, member as never, {
      realm: "eurth",
      html: "<p>see [ixaction=a1]</p>",
    });
    expect(out.reward).toBeNull();
  });

  it("reads the stored message before it pays, so a failing read cannot follow a paid reward", async () => {
    const store = boardStore();
    const order: string[] = [];
    const find = store.db.forumPost.findUnique;
    store.db.forumPost.findUnique = ((args: Parameters<typeof find>[0]) => {
      order.push("read");
      return find(args);
    }) as typeof find;
    jest.mocked(rewardNewLinks).mockImplementationOnce(async () => {
      order.push("reward");
      return { amount: 5 };
    });
    await postBoardMessage(store.db as never, member as never, {
      realm: "eurth",
      html: "<p>see [ixaction=a1]</p>",
    });
    expect(order.at(-1)).toBe("reward");
    expect(order.filter((step) => step === "reward")).toHaveLength(1);
  });
});
