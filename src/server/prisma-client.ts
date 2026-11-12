/**
 * Prisma 7 connects through a driver adapter (pg), not its own engine. Every PrismaClient in the app, the scripts
 * and the tests is built here so the pool reads the same DATABASE_URL settings Prisma 6 did.
 */
import { availableParallelism } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

type PoolConfig = Exclude<ConstructorParameters<typeof PrismaPg>[0], string | { query: unknown }>;

/** URL parameters only Prisma's engine read; pg would ignore them, so they become pool settings and are dropped. */
const PRISMA_ONLY_PARAMS = [
  "connection_limit",
  "pool_timeout",
  "connect_timeout",
  "socket_timeout",
  "schema",
  "pgbouncer",
  "statement_cache_size",
];

const seconds = (value: string | null): number | undefined => {
  const n = value === null ? Number.NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? n * 1000 : undefined;
};

/**
 * The pg pool for a Prisma-style URL, with Prisma 6's defaults where the URL is silent: `connection_limit`
 * (default cores × 2 + 1) is the pool size, and the time to get a connection is `pool_timeout`, else
 * `connect_timeout`, else 10 s.
 */
// ponytail: pg has one wait (connect or acquire) where Prisma 6 had two; the longer of the URL's two wins.
export function poolConfigFor(url: string): { pool: PoolConfig; schema: string | undefined } {
  const parsed = new URL(url);
  const params = parsed.searchParams;
  const limit = Number(params.get("connection_limit"));
  const wait = Math.max(seconds(params.get("pool_timeout")) ?? 0, seconds(params.get("connect_timeout")) ?? 0);
  const schema = params.get("schema") ?? undefined;
  for (const key of PRISMA_ONLY_PARAMS) params.delete(key);
  return {
    pool: {
      connectionString: parsed.toString(),
      max: Number.isInteger(limit) && limit > 0 ? limit : availableParallelism() * 2 + 1,
      connectionTimeoutMillis: wait > 0 ? wait : 10_000,
    },
    schema,
  };
}

/** The pg adapter for `url` (default DATABASE_URL). Without a URL pg reads the PG* variables, as libpq does. */
export function prismaAdapter(url: string | undefined = process.env.DATABASE_URL): PrismaPg {
  if (!url) return new PrismaPg({});
  const { pool, schema } = poolConfigFor(url);
  return new PrismaPg(pool, schema ? { schema } : undefined);
}

type ClientOptions = Omit<Prisma.PrismaClientOptions, "adapter" | "accelerateUrl"> & { url?: string };

/** `new PrismaClient()` for Prisma 7: the same client over the pg adapter. */
export function createPrismaClient({ url, ...options }: ClientOptions = {}): PrismaClient {
  return new PrismaClient({ ...options, adapter: prismaAdapter(url) });
}
