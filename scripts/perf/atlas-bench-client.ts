/**
 * scripts/perf/atlas-bench-client.ts - the benchmark's Prisma client, which counts SQL statements, and its helpers.
 *
 * A side-effect import, and it must be the FIRST import of atlas-bench.ts: `~/server/db` reads
 * `globalThis.prisma` once, when it first loads, so the client is registered here before any server module
 * (the route handlers, the loaders) pulls `db` in. They then run on this client, one statement counted per
 * `query` event. (The app's own client adds a findMany row cap and slow-query timing around the same engine.)
 * The server modules log progress with console.log; the benchmark's output is its table, so that is silenced here.
 */
import { PrismaClient } from "@prisma/client";
import { setTimeout as sleep } from "node:timers/promises";

console.log = () => undefined;

export const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
Object.assign(globalThis, { prisma: client });

const WRITE = /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b/i;
let statements = 0;
const writes: string[] = [];
client.$on("query", ({ query }) => {
  statements++;
  if (WRITE.test(query)) writes.push(query.slice(0, 80));
});

/** Runs `work` and returns its result with the number of SQL statements it issued. */
export async function countStatements<T>(
  work: () => Promise<T>
): Promise<{ result: T; statements: number }> {
  statements = 0;
  const result = await work();
  // Prisma emits query events a moment after the statement completes
  await sleep(50);
  return { result, statements };
}

/** The write statements (insert, update, delete, DDL) this process has issued so far; the benchmark issues none. */
export async function writeStatements(): Promise<readonly string[]> {
  await sleep(50);
  return writes;
}

/** Runs `work` and returns its result with the wall time it took, in ms. */
export async function timed<T>(work: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const startedAt = performance.now();
  const result = await work();
  return { result, ms: performance.now() - startedAt };
}
