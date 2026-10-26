/** @jest-environment node */
/**
 * The router split parity check: it reads every procedure of a `createTRPCRouter` call (string keys and shorthand
 * members included), treats a layout-only difference as no change, and reports a missing, extra, doubled or changed
 * procedure; a directory or an `index.ts` stands for its `.ts` files without tests.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  compareSplit,
  isClean,
  proceduresIn,
  runCLI,
  splitFiles,
} from "../../../scripts/verify-router-splits";

const router = (members: string) =>
  `import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";\n` +
  `export const r = createTRPCRouter({ ${members} });\n`;

describe("proceduresIn", () => {
  it("reads assignments, string keys and shorthand members", () => {
    const text =
      `const shared = publicProcedure.query(() => 2);\n` +
      router(
        `get: publicProcedure.query(() => 1), "get-two": publicProcedure.query(() => 3), shared`
      );
    expect(proceduresIn("a.ts", text)).toEqual([
      { key: "get", body: "publicProcedure.query(() => 1)" },
      { key: "get-two", body: "publicProcedure.query(() => 3)" },
      { key: "shared", body: "publicProcedure.query(() => 2)" },
    ]);
  });

  it("refuses a member it cannot compare", () => {
    expect(() => proceduresIn("b.ts", router("...other"))).toThrow(/unsupported router member/);
    expect(() => proceduresIn("c.ts", router("missing"))).toThrow(/has no const/);
  });

  it("ignores files with no router", () => {
    expect(proceduresIn("d.ts", "export const x = mergeRouters(a, b);")).toEqual([]);
  });
});

describe("compareSplit", () => {
  const before = [
    { key: "a", body: "publicProcedure.query(() => 1)" },
    { key: "b", body: 'publicProcedure.query(() => "x")' },
    { key: "c", body: "publicProcedure.query(() => 3)" },
  ];

  it("passes a split that only moved and reformatted the procedures", async () => {
    const after = [
      { key: "b", body: "publicProcedure.query(\n  () => 'x',\n)" },
      { key: "a", body: "publicProcedure.query(() =>   1)" },
      { key: "c", body: "publicProcedure.query(() => 3)" },
    ];
    const result = await compareSplit(before, after);
    expect(result).toEqual({
      missing: [],
      extra: [],
      duplicated: [],
      changed: [],
      matched: 3,
      total: 3,
    });
    expect(isClean(result)).toBe(true);
  });

  it("reports missing, extra, doubled and changed procedures", async () => {
    const after = [
      { key: "a", body: "publicProcedure.query(() => 2)" },
      { key: "b", body: 'publicProcedure.query(() => "x")' },
      { key: "b", body: 'publicProcedure.query(() => "x")' },
      { key: "d", body: "publicProcedure.query(() => 4)" },
    ];
    const result = await compareSplit(before, after);
    expect(result).toEqual({
      missing: ["c"],
      extra: ["d"],
      duplicated: ["b"],
      changed: ["a"],
      matched: 1,
      total: 3,
    });
    expect(isClean(result)).toBe(false);
  });

  it.each([
    [{ missing: ["x"] }],
    [{ extra: ["x"] }],
    [{ duplicated: ["x"] }],
    [{ changed: ["x"] }],
  ])("is not clean with %p", (part) => {
    const empty = { missing: [], extra: [], duplicated: [], changed: [], matched: 0, total: 0 };
    expect(isClean({ ...empty, ...part })).toBe(false);
  });
});

describe("splitFiles and the CLI", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-split-"));
    fs.mkdirSync(path.join(dir, "split", "nested"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "before.ts"),
      router("a: publicProcedure.query(() => 1), b: x")
    );
    fs.writeFileSync(path.join(dir, "split", "index.ts"), "export const r = mergeRouters(a, b);\n");
    fs.writeFileSync(path.join(dir, "split", "a.ts"), router("a: publicProcedure.query(() => 1)"));
    fs.writeFileSync(path.join(dir, "split", "nested", "b.ts"), router("b: x"));
    fs.writeFileSync(path.join(dir, "split", "a.test.ts"), router("t: y"));
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it("reads a directory, or an index.ts as its directory, without tests", () => {
    const split = path.join(dir, "split");
    const expected = [
      path.join(split, "a.ts"),
      path.join(split, "index.ts"),
      path.join(split, "nested", "b.ts"),
    ];
    expect(splitFiles([split])).toEqual(expected);
    expect(splitFiles([path.join(split, "index.ts")])).toEqual(expected);
    expect(splitFiles([path.join(split, "a.ts")])).toEqual([path.join(split, "a.ts")]);
  });

  it("exits 0 on parity, 1 on a difference and 2 without arguments or procedures", async () => {
    const before = path.join(dir, "before.ts");
    expect(await runCLI([before, path.join(dir, "split")])).toBe(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("2/2 procedures match"));
    expect(await runCLI([before, path.join(dir, "split", "a.ts")])).toBe(1);
    expect(console.log).toHaveBeenCalledWith("  missing from the split: b");
    expect(await runCLI([before])).toBe(2);
    expect(await runCLI([path.join(dir, "split", "index.ts"), path.join(dir, "split")])).toBe(2);
  });
});
