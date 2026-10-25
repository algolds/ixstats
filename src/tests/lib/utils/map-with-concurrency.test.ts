import { mapWithConcurrency } from "~/lib/utils/map-with-concurrency";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("mapWithConcurrency", () => {
  it("never runs more than the limit at once, and answers in the input's order", async () => {
    let inFlight = 0;
    let most = 0;
    const out = await mapWithConcurrency([5, 4, 3, 2, 1, 0, 9, 8], 3, async (n) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await tick();
      inFlight -= 1;
      return n * 2;
    });
    expect(out).toEqual([10, 8, 6, 4, 2, 0, 18, 16]);
    expect(most).toBe(3);
  });

  it("passes each item's index", async () => {
    expect(await mapWithConcurrency(["a", "b"], 4, async (s, i) => `${s}${i}`)).toEqual([
      "a0",
      "b1",
    ]);
  });

  it("answers an empty list at once", async () => {
    const work = jest.fn();
    expect(await mapWithConcurrency([], 2, work)).toEqual([]);
    expect(work).not.toHaveBeenCalled();
  });

  it("rejects with the first failure", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("two");
        return n;
      })
    ).rejects.toThrow("two");
  });

  it("runs one at a time with a limit below one", async () => {
    let inFlight = 0;
    let most = 0;
    await mapWithConcurrency([1, 2, 3], 0, async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await tick();
      inFlight -= 1;
    });
    expect(most).toBe(1);
  });

  it("stops taking items once one fails", async () => {
    const work = jest.fn(async (n: number) => {
      if (n === 1) throw new Error("one");
      await tick();
      return n;
    });
    await expect(mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, work)).rejects.toThrow("one");
    await tick();
    await tick();
    // The other worker finishes the item it holds, and takes no more.
    expect(work.mock.calls.map(([n]) => n)).toEqual([1, 2]);
  });

  it.each([Number.NaN, -3, 0.5])(
    "runs one at a time, and every item, for a limit of %s",
    async (limit) => {
      let inFlight = 0;
      let most = 0;
      const out = await mapWithConcurrency([1, 2, 3], limit, async (n) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await tick();
        inFlight -= 1;
        return n;
      });
      expect(out).toEqual([1, 2, 3]);
      expect(most).toBe(1);
    }
  );
});
