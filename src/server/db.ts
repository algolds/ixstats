import { PrismaClient } from "@prisma/client";

import { env } from "~/env";
// Import from standalone query-monitor to avoid circular dependency with database-optimizations
import { queryMonitor } from "~/lib/query-monitor";

// Check if we're in read-only mode (development with production data)
const isReadOnlyMode = process.env.DATABASE_READONLY === "true";

// Slow query threshold in milliseconds
const SLOW_QUERY_THRESHOLD_MS = 100;

/**
 * Creates a Prisma client with optional read-only protection and query monitoring.
 * In read-only mode, all write operations (create, update, delete, upsert)
 * are blocked at the application level to protect production data.
 */
const createPrismaClient = () => {
  // Configure logging based on environment
  // In development: log queries as events for duration tracking
  // In production: log errors and slow queries only
  const baseClient = new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ],
  });

  // Set up slow query logging and performance monitoring
  baseClient.$on("query", (e) => {
    // Record query metrics for performance analysis
    queryMonitor.recordQuery({
      queryKey: e.query.substring(0, 100),
      duration: e.duration,
      success: true,
      timestamp: Date.now(),
    });

    // Log slow queries (>100ms) in all environments
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(
        `[SLOW_QUERY] ${e.duration}ms | ${e.query.substring(0, 200)}${e.query.length > 200 ? "..." : ""}`
      );
    } else if (env.NODE_ENV === "development" && e.duration > 50) {
      // In development, also log moderately slow queries (>50ms) for optimization awareness
      console.log(`[QUERY] ${e.duration}ms | ${e.query.substring(0, 100)}...`);
    }
  });

  // If not in read-only mode, return the base client
  if (!isReadOnlyMode) {
    return baseClient;
  }

  // In read-only mode, extend the client to block write operations
  console.log("\x1b[33m[DATABASE] Read-only mode enabled - write operations blocked\x1b[0m");
  
  return baseClient.$extends({
    query: {
      $allModels: {
        async create({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async createMany({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async createManyAndReturn({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async update({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async updateMany({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async delete({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async deleteMany({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
        async upsert({ args, query }) {
          throw new Error("[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.");
        },
      },
    },
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();
export { db as prisma };

// Export read-only mode flag for use in other parts of the application
export const isDatabaseReadOnly = isReadOnlyMode;

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
