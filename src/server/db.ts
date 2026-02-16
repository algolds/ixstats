import { PrismaClient } from "@prisma/client";

import { env } from "~/env";
// Import from standalone query-monitor to avoid circular dependency with database-optimizations
import { queryMonitor } from "~/lib/query-monitor";
import { isDevMode } from "~/lib/dev-memory-config";

// Check if we're in read-only mode (development with production data)
const isReadOnlyMode = process.env.DATABASE_READONLY === "true";

// Slow query threshold in milliseconds (higher in dev to reduce log noise and memory)
const SLOW_QUERY_THRESHOLD_MS = isDevMode ? 500 : 100;

/**
 * Creates a Prisma client with optional read-only protection and query monitoring.
 * In read-only mode, all write operations (create, update, delete, upsert)
 * are blocked at the application level to protect production data.
 * 
 * Memory optimization: In development, we reduce logging verbosity to save memory.
 */
const createPrismaClient = () => {
  // Configure logging based on environment
  // In development: minimal logging to reduce memory usage
  // In production: log queries as events for duration tracking
  const baseClient = new PrismaClient({
    log: isDevMode
      ? [
          // Development: errors only to reduce memory from query logging
          { level: "error", emit: "stdout" },
        ]
      : [
          // Production: full query logging for performance analysis
          { level: "query", emit: "event" },
          { level: "error", emit: "stdout" },
          { level: "warn", emit: "stdout" },
        ],
  });

  // Only set up query monitoring in production (saves memory in dev)
  if (!isDevMode) {
    baseClient.$on("query", (e) => {
      // Record query metrics for performance analysis
      queryMonitor.recordQuery({
        queryKey: e.query.substring(0, 100),
        duration: e.duration,
        success: true,
        timestamp: Date.now(),
      });

      // Log slow queries (>100ms) in production
      if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(
          `[SLOW_QUERY] ${e.duration}ms | ${e.query.substring(0, 200)}${e.query.length > 200 ? "..." : ""}`
        );
      }
    });
  }

  // Log memory config on startup in development
  if (isDevMode) {
    console.log("[DATABASE] Development mode - reduced logging for memory optimization");
  }

  // If not in read-only mode, return the base client
  if (!isReadOnlyMode) {
    return baseClient;
  }

  // Models that are writable even in read-only mode
  const WRITABLE_MODELS_IN_READONLY = new Set([
    // Vault / card system
    "Card", "CardOwnership", "CardPack", "CardPackOpening",
    "MyVault", "VaultTransaction", "NSVerification",
    "CardTrade", "CardTradeOffer", "CardAuction", "CardBid",
    "CardCollection", "CardCollectionItem", "CraftingRecipe",
    // NS sync management
    "SyncLog", "SyncCheckpoint",
    // Country stats & economic calculations
    "Country", "EconomicProfile", "LaborMarket", "FiscalSystem",
    "IncomeDistribution", "GovernmentBudget", "Demographics",
    "HistoricalDataPoint", "CalculationLog", "NationalIdentity",
    "AuditLog", "DmInputs", "User",
  ]);

  // In read-only mode, extend the client to block write operations
  // except for vault/card models which are allowed for dev testing
  console.log("\x1b[33m[DATABASE] Read-only mode enabled - write operations blocked (vault tables exempted)\x1b[0m");

  const READONLY_ERROR = "[READ-ONLY MODE] Database write operations are blocked in development. The database contains production data.";

  return baseClient.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async createMany({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async createManyAndReturn({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async update({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async updateMany({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async delete({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async deleteMany({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
        },
        async upsert({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(READONLY_ERROR);
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
