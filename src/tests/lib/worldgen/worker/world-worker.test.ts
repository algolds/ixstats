/**
 * The worker file itself: loaded as a script it listens on the worker scope and answers on it, with the
 * transferables in the transfer list. jsdom's window stands in for the worker scope.
 */

import type { WorldWorkerRequest, WorldWorkerResponse } from "~/lib/worldgen/worker/world-messages";

describe("worldgen/world.worker", () => {
  it("answers a generate message on the scope, transferring the buffers", () => {
    const posts: { message: WorldWorkerResponse; transfer: ArrayBuffer[] }[] = [];
    const postMessage = jest
      .spyOn(window, "postMessage")
      .mockImplementation((message, transfer) => {
        posts.push({ message, transfer: transfer as never });
      });
    jest.isolateModules(() => {
      require("~/lib/worldgen/worker/world.worker");
    });
    expect(typeof window.onmessage).toBe("function");

    const data: WorldWorkerRequest = {
      type: "generate",
      id: 9,
      params: { cellCount: 1500 },
      seed: 3,
    };
    window.onmessage?.call(window, new MessageEvent("message", { data }));

    const { message, transfer } = posts[posts.length - 1]!;
    expect(message).toMatchObject({ type: "result", id: 9 });
    if (message.type !== "result") throw new Error("expected a result");
    expect(transfer).toContain(message.cells);
    expect(transfer).toContain(message.relief.rgba);
    expect(
      posts.slice(0, -1).every((p) => p.message.type === "progress" && p.transfer.length === 0)
    ).toBe(true);

    postMessage.mockRestore();
    window.onmessage = null;
  });
});
