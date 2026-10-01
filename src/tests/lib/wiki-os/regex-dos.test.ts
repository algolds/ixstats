/** @jest-environment node */
/**
 * The regex-DoS gate: every function that reads page text (the list is scripts/audit/wikios-regex-fuzz-
 * targets.ts, the same one the 2 MB fuzz script runs) is given ~200 KB of every hostile family and must
 * answer within the budget. A text of openers that never close, nested openers, unicode spaces, entities
 * and seeded random soups of them all take a linear function a few milliseconds and a quadratic one
 * seconds, so the budget has room for a loaded machine: the best of two runs counts, and a function that
 * is over the budget on a tenth of the text is failed at once instead of being run on all of it (a linear
 * function takes a tenth of its time there, a quadratic one a hundredth).
 */
import {
  TARGETS,
  familiesFor,
  inputFor,
  runSize,
  type Target,
} from "../../../../scripts/audit/wikios-regex-fuzz-targets";

const SIZE = 200_000;
const BUDGET_MS = 150;

type Call = Awaited<ReturnType<Target["load"]>>;

/** Milliseconds `call(input)` takes; a refusal (it threw) is an answer too. */
async function time(call: Call, input: string): Promise<number> {
  const began = performance.now();
  try {
    await call(input);
  } catch {
    // too large, malformed: how fast it said so is what counts
  }
  return performance.now() - began;
}

/** The best of two runs when the first is over the budget (a busy machine), else the first. */
async function best(call: Call, input: string, budget: number): Promise<number> {
  const first = await time(call, input);
  return first > budget ? Math.min(first, await time(call, input)) : first;
}

/** The families `target` is slow on, as messages. */
async function slowFamilies(target: Target): Promise<string[]> {
  const call = await target.load();
  await time(call, "<p>{{a}} [[b]] 'c'</p>"); // what a function sets up on its first call (a DOM, a table) is not what is measured
  const slow: string[] = [];
  const size = runSize(target, SIZE);
  const budget = BUDGET_MS * (target.limits?.slowFactor ?? 1);
  for (const family of familiesFor(target.kind)) {
    const probe = await best(call, inputFor(target.kind, family, size / 10), budget);
    if (probe > budget) {
      slow.push(`${family.name}: ${probe.toFixed(0)} ms on ${size / 10_000} KB`);
      continue;
    }
    const ms = await best(call, inputFor(target.kind, family, size), budget);
    if (ms > budget) slow.push(`${family.name}: ${ms.toFixed(0)} ms on ${size / 1000} KB`);
  }
  return slow;
}

describe("regex DoS gate: hostile page text", () => {
  // A function that logs the text it was given when it refuses it (a malformed URL) logs 200 KB of it per call.
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it("lists every target once", () => {
    const names = TARGETS.map((target) => target.name);
    expect(new Set(names).size).toBe(names.length);
  });

  describe.each(TARGETS.map((target) => [target.name, target] as const))("%s", (_name, target) => {
    it(`answers within ${BUDGET_MS} ms (times what its target is granted) on ${SIZE / 1000} KB of every hostile family`, async () => {
      expect(await slowFamilies(target)).toEqual([]);
    }, 120_000);
  });
});
