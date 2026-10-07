import { coalesceToFrame } from "~/lib/frame-coalesce";

/** A requestAnimationFrame the test steps by hand. */
function controlledFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queue.set(next, cb);
    return next++;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => void queue.delete(id));
  return {
    pending: () => queue.size,
    frame: () => {
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((cb) => cb(0));
    },
  };
}

afterEach(() => jest.restoreAllMocks());

describe("coalesceToFrame", () => {
  it("runs once per frame with the latest value", () => {
    const frames = controlledFrames();
    const fn = jest.fn();
    const move = coalesceToFrame(fn);

    move.schedule(1);
    move.schedule(2);
    move.schedule(3);
    expect(fn).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(1);

    frames.frame();
    expect(fn.mock.calls).toEqual([[3]]);

    move.schedule(4);
    frames.frame();
    expect(fn.mock.calls).toEqual([[3], [4]]);
  });

  it("flush applies the pending value now, so a drag ends exactly where the pointer did", () => {
    const frames = controlledFrames();
    const fn = jest.fn();
    const move = coalesceToFrame(fn);

    move.schedule(7);
    move.flush();
    expect(fn.mock.calls).toEqual([[7]]);
    frames.frame();
    expect(fn).toHaveBeenCalledTimes(1);

    move.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel drops the pending value", () => {
    const frames = controlledFrames();
    const fn = jest.fn();
    const move = coalesceToFrame(fn);
    move.schedule(1);
    move.cancel();
    frames.frame();
    expect(fn).not.toHaveBeenCalled();
  });
});
