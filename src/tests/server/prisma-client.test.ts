/** @jest-environment node */
import { availableParallelism } from "node:os";
import { poolConfigFor } from "~/server/prisma-client";

describe("poolConfigFor", () => {
  it("turns Prisma's URL parameters into the pg pool and drops them from the URL", () => {
    const { pool, schema } = poolConfigFor(
      "postgresql://u:p@db:5433/ixstats?connection_limit=20&pool_timeout=30&connect_timeout=10&schema=app&sslmode=require"
    );
    expect(pool.max).toBe(20);
    expect(pool.connectionTimeoutMillis).toBe(30_000);
    expect(schema).toBe("app");
    expect(pool.connectionString).toBe("postgresql://u:p@db:5433/ixstats?sslmode=require");
  });

  it("keeps Prisma 6's defaults when the URL says nothing", () => {
    const { pool, schema } = poolConfigFor("postgresql://u:p@db:5433/ixstats");
    expect(pool.max).toBe(availableParallelism() * 2 + 1);
    expect(pool.connectionTimeoutMillis).toBe(10_000);
    expect(schema).toBeUndefined();
  });
});
