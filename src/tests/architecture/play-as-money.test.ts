/**
 * Play-as never moves money (owner decision 2026-10-21): every mutation that moves IxCredits,
 * Sovereigns or card copies refuses while an admin plays as another user.
 *
 * The money mutations are found by what their code writes, not by name. A router procedure moves
 * money when its body writes a money table, or uses a name whose defining module does (imports are
 * followed through barrels to the file that defines each name, then module to module). Each one,
 * and every mutation under a `PLAY_AS_MONEY_ROUTES` entry, is called as an admin playing as a member
 * against a database that throws on any use: it must refuse before it reads anything.
 *
 * A new money mutation outside `PLAY_AS_MONEY_ROUTES` fails the first case; a new money router
 * also changes the list of routers the third case prints.
 */
jest.mock("~/server/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => {
        throw new Error("play-as reached the database");
      },
    }
  ),
  isDatabaseReadOnly: false,
}));

import fs from "fs";
import path from "path";
import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { PLAY_AS_MONEY_ROUTES, isPlayAsMoneyPath } from "~/server/api/trpc/impersonation";
import { db } from "~/server/db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const SRC = path.resolve(__dirname, "../..");
const ROUTERS = path.join(SRC, "server/api/routers");
/** Modules the scan does not follow, with the reason: none of them moves money inside a request. */
const NOT_FOLLOWED: Record<string, string> = {
  [path.join(SRC, "server/api/trpc")]:
    "imported by every router; the context's user creation pays the new-player bonus",
  [path.join(SRC, "server/cron/jobs.ts")]:
    "the cron registry; its jobs' load() imports run on the cron runner, not in a request",
};
const followed = (file: string) => !Object.keys(NOT_FOLLOWED).some((skip) => file.startsWith(skip));

/** A write to a table that holds IxCredits, Sovereigns or card ownership, through Prisma or raw SQL. */
const MONEY_WRITE = new RegExp(
  String.raw`\b(vaultTransaction|myVault|cardOwnership|cardTransferEvent|cardDustBalance|cardDustEvent|cardListing|cardAuction|auctionBid|tradeOffer|exchangeWallet|exchangeTransaction|shareholding|shareListing|shareIssuance|companyDividend|sectorPosition|contractBid)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b` +
    String.raw`|\b(UPDATE|INSERT INTO|DELETE FROM)\s+"?(MyVault|VaultTransaction|CardOwnership|CardDustBalance|CardListing|CardAuction|TradeOffer|ExchangeWallet|ExchangeTransaction|Shareholding|ShareListing)\b`
);

const IMPORT =
  /\bimport\s+(type\s+)?(?:([\w$]+)\s*,?\s*)?(\*\s*as\s+[\w$]+|\{[^}]*\})?\s*from\s*["']([^"']+)["']/g;
const REEXPORT =
  /\bexport\s+(type\s+)?(\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;
const BARE_IMPORT = /(?:^\s*import\s*|\bimport\(\s*)["']([^"']+)["']/gm;
const TOP_LEVEL =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+|const\s+|let\s+|class\s+)([\w$]+)/gm;
const PROCEDURE = /^([ \t]+)([\w$]+)\s*:\s*[\w$.]*Procedure\b/gm;

const escape = (name: string) => name.replace(/\$/g, "\\$");
const mentions = (text: string, name: string) =>
  new RegExp(String.raw`\b${escape(name)}\b`).test(text);

const sources = new Map<string, string>();
function read(file: string): string {
  if (!sources.has(file)) sources.set(file, fs.readFileSync(file, "utf8"));
  return sources.get(file)!;
}

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("~/")
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

/** `{ a, b as c, type d }` as [name, local] pairs, type-only names dropped. */
function specifiers(braces: string): Array<[string, string]> {
  return braces
    .slice(1, -1)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith("type "))
    .map((part) => {
      const [name, local = name] = part.split(/\s+as\s+/);
      return [name!, local!];
    });
}

function defines(file: string, name: string): boolean {
  const source = read(file);
  const n = escape(name);
  return (
    new RegExp(
      String.raw`\bexport\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|enum)\s+${n}\b`
    ).test(source) ||
    new RegExp(String.raw`\bexport\s*\{[^}]*\b${n}\b[^}]*\}(?!\s*from)`).test(source)
  );
}

/** The files that define `name` as `file` exports it, following re-exports through barrels. */
function definingFiles(file: string, name: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  if (defines(file, name)) return [file];
  return [...read(file).matchAll(REEXPORT)].flatMap(([, typeOnly, what, spec]) => {
    const target = typeOnly ? null : resolve(file, spec!);
    if (!target) return [];
    if (what === "*") return definingFiles(target, name, seen);
    if (what!.startsWith("*")) return what!.endsWith(` ${name}`) ? [target] : [];
    const named = specifiers(what!).find(([, local]) => local === name);
    if (!named) return [];
    const found = definingFiles(target, named[0], seen);
    return found.length > 0 ? found : [target];
  });
}

/** Each runtime name `file` imports, mapped to the files that define it (bare imports keyed by path). */
function importsOf(file: string): Map<string, string[]> {
  const source = read(file);
  const names = new Map<string, string[]>();
  for (const [, typeOnly, defaultName, rest, spec] of source.matchAll(IMPORT)) {
    const target = typeOnly ? null : resolve(file, spec!);
    if (!target) continue;
    if (defaultName) names.set(defaultName, [target]);
    if (rest?.startsWith("*")) names.set(rest.split(/\s+/).pop()!, [target]);
    for (const [name, local] of rest?.startsWith("{") ? specifiers(rest) : []) {
      const found = definingFiles(target, name);
      names.set(local, found.length > 0 ? found : [target]);
    }
  }
  for (const [, typeOnly, , spec] of source.matchAll(REEXPORT)) {
    const target = typeOnly ? null : resolve(file, spec!);
    if (target) names.set(`re-export ${target}`, [target]);
  }
  for (const [, spec] of source.matchAll(BARE_IMPORT)) {
    const target = resolve(file, spec!);
    if (target) names.set(`import ${target}`, [target]);
  }
  return names;
}

/** Every module reachable from the routers whose code writes money, directly or through its imports. */
function moneyModules(): Set<string> {
  const deps = new Map<string, string[]>();
  const queue = walk(ROUTERS);
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (deps.has(file)) continue;
    const next = [...importsOf(file).values()].flat().filter(followed);
    deps.set(file, next);
    queue.push(...next);
  }
  const money = new Set([...deps.keys()].filter((file) => MONEY_WRITE.test(read(file))));
  for (let grew = true; grew;) {
    grew = false;
    for (const [file, next] of deps) {
      if (!money.has(file) && next.some((dep) => money.has(dep))) {
        money.add(file);
        grew = true;
      }
    }
  }
  return money;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** `name: <builder>Procedure ... .mutation(` properties of a router file, each with its own text. */
function mutationsIn(source: string): Array<[string, string]> {
  return [...source.matchAll(PROCEDURE)].flatMap((match) => {
    const indent = match[1]!.length;
    const rest = source.slice(match.index!);
    const end = new RegExp(String.raw`\n[ \t]{0,${indent}}\S`).exec(rest.slice(match[0].length));
    const text = rest.slice(0, end ? match[0].length + end.index : undefined);
    return /\.mutation\(/.test(text) ? [[match[2]!, text] as [string, string]] : [];
  });
}

/** Top-level declarations of a file, each with its own text. */
function declarationsIn(source: string): Map<string, string> {
  const tops = [...source.matchAll(TOP_LEVEL)];
  return new Map(tops.map((m, i) => [m[1]!, source.slice(m.index, tops[i + 1]?.index)]));
}

const pathOf = new Map<unknown, string>(
  Object.entries(appRouter._def.procedures).map(([route, procedure]) => [procedure, route])
);

/** The app paths of the procedures `file` exports (in a router or a procedure record) under `name`. */
function appPaths(file: string, name: string): string[] {
  const exported = require(file) as Record<string, { _def?: { procedures?: object } } | null>;
  return Object.values(exported).flatMap((value) =>
    Object.entries(value?._def?.procedures ?? (typeof value === "object" ? (value ?? {}) : {}))
      .filter(([key]) => key.split(".").pop() === name)
      .flatMap(([, procedure]) => pathOf.get(procedure) ?? [])
  );
}

/**
 * Scans every router file: `scanned` holds each app mutation the scan read, `money` the ones that move
 * money, with the names in their bodies that make them so.
 */
function scanMutations() {
  const moneyFiles = moneyModules();
  const scanned = new Set<string>();
  const money = new Map<string, string>();
  for (const file of walk(ROUTERS)) {
    const source = read(file);
    if (!/\.mutation\(/.test(source)) continue;
    const moneyNames = [...importsOf(file)]
      .filter(([, files]) => files.some((dep) => moneyFiles.has(dep)))
      .map(([name]) => name);
    const locals = declarationsIn(source);
    const moneyLocals = new Set(
      [...locals].filter(([, text]) => MONEY_WRITE.test(text)).map(([n]) => n)
    );
    for (let grew = true; grew;) {
      grew = false;
      for (const [name, text] of locals) {
        const uses = [...moneyNames, ...moneyLocals].some(
          (other) => other !== name && mentions(text, other)
        );
        if (!moneyLocals.has(name) && uses) {
          moneyLocals.add(name);
          grew = true;
        }
      }
    }
    for (const [name, text] of mutationsIn(source)) {
      const routes = appPaths(file, name);
      for (const route of routes) scanned.add(route);
      const via = [...moneyNames, ...moneyLocals].filter((other) => mentions(text, other));
      if (MONEY_WRITE.test(text)) via.push("a money write");
      const why = `${path.relative(ROUTERS, file)} ${name} via ${via.slice(0, 3).join(", ")}`;
      if (via.length > 0) for (const route of routes) money.set(route, why);
    }
  }
  return { scanned, money };
}

type Callable = (input?: unknown) => Promise<unknown>;
const caller = createCallerFactory(appRouter)(
  createMockCallerContext({
    db,
    auth: { userId: "member_clerk" },
    user: {
      id: "member_1",
      clerkUserId: "member_clerk",
      countryId: "country_1",
      role: { name: "user", level: 100 },
    },
    impersonatorId: "admin_clerk",
    rateLimitIdentifier: "user:admin_clerk",
  })
) as unknown as Record<string, unknown>;
const call = (route: string) =>
  route
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], caller) as Callable;

/** How a mutation answers an admin playing as a member: "money", "admin", or what it did instead. */
async function playAsOutcome(route: string): Promise<string> {
  try {
    await call(route)(undefined);
    return "ran";
  } catch (error) {
    const { message, cause } = error as { message: string; cause?: { code?: string } };
    if (cause?.code !== "FORBIDDEN")
      return message.startsWith("[") ? "reached input parsing" : message;
    if (message.startsWith("Money and card actions are disabled while playing as another user"))
      return "money";
    if (message.startsWith("Admin actions are disabled while playing as another user"))
      return "admin";
    return message;
  }
}

const mutations = Object.entries(appRouter._def.procedures)
  .filter(([, procedure]) => (procedure as { _def: { type: string } })._def.type === "mutation")
  .map(([route]) => route);

describe("play-as never moves money", () => {
  const { scanned, money: found } = scanMutations();
  const outcomes = new Map<string, string>();
  beforeAll(async () => {
    for (const level of ["info", "log", "warn", "error"] as const) {
      jest.spyOn(console, level).mockImplementation(() => {});
    }
    const routes = new Set([...found.keys(), ...mutations.filter(isPlayAsMoneyPath)]);
    for (const route of routes) outcomes.set(route, await playAsOutcome(route));
  });

  it("reads every app mutation in the router sources, so none escapes the scan", () => {
    expect(mutations.length).toBeGreaterThan(600);
    expect(mutations.filter((route) => !scanned.has(route))).toEqual([]);
  });

  it("refuses every mutation that moves money, found by what it writes, before it reads anything", () => {
    const missed = [...found]
      .filter(([route]) => !["money", "admin"].includes(outcomes.get(route)!))
      .map(([route, why]) => `${route}: ${outcomes.get(route)} (${why})`);
    expect(missed).toEqual([]);
  });

  it("refuses every mutation under a money route, whatever its builder", () => {
    const listed = mutations.filter(isPlayAsMoneyPath);
    expect(listed.length).toBeGreaterThan(100);
    expect(listed.filter((route) => !["money", "admin"].includes(outcomes.get(route)!))).toEqual(
      []
    );
  });

  it("finds money in these routers, and each money route still covers a mutation that moves money", () => {
    const moneyRoutes = [...found.keys()].filter((route) => outcomes.get(route) === "money");
    expect([...new Set(moneyRoutes.map((route) => route.split(".")[0]))].sort()).toEqual([
      "achievements",
      "cardMarket",
      "cardPacks",
      "cards",
      "crafting",
      "exchange",
      "nsImport",
      "sports",
      "trading",
      "vault",
    ]);
    const stale = PLAY_AS_MONEY_ROUTES.filter(
      (entry) => !moneyRoutes.some((route) => route === entry || route.startsWith(`${entry}.`))
    );
    expect(stale).toEqual([]);
  });
});
