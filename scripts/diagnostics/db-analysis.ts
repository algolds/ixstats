#!/usr/bin/env npx tsx
/**
 * IxStats Database Analysis Script
 *
 * Analyzes database performance, query patterns, and provides optimization recommendations.
 * Run with: npx tsx scripts/diagnostics/db-analysis.ts
 */

import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

// ============================================================================
// Types
// ============================================================================

interface TableStats {
  name: string;
  rowCount: number;
  sizeBytes?: number;
}

interface QueryBenchmark {
  name: string;
  query: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  samples: number;
}

interface AnalysisResult {
  tables: TableStats[];
  benchmarks: QueryBenchmark[];
  recommendations: string[];
  warnings: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const SLOW_QUERY_THRESHOLD = 100; // ms
const BENCHMARK_ITERATIONS = 5;

// Critical tables to analyze
const CRITICAL_TABLES = [
  "Country",
  "User",
  "Embassy",
  "DiplomaticRelation",
  "GovernmentComponent",
  "SystemConfig",
  "AuditLog",
  "ThinkpagesPost",
];

// ============================================================================
// Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ============================================================================
// Database Analysis Functions
// ============================================================================

async function getTableStats(prisma: PrismaClient): Promise<TableStats[]> {
  const stats: TableStats[] = [];

  for (const tableName of CRITICAL_TABLES) {
    try {
      // Get row count using Prisma
      const modelName = tableName.charAt(0).toLowerCase() + tableName.slice(1);
      const model = (prisma as any)[modelName];

      if (model && typeof model.count === "function") {
        const count = await model.count();
        stats.push({ name: tableName, rowCount: count });
      }
    } catch (error) {
      // Table might not exist or have different name
      stats.push({ name: tableName, rowCount: -1 });
    }
  }

  // Try to get table sizes from PostgreSQL
  try {
    const sizeResult = await prisma.$queryRaw<Array<{ table_name: string; size: bigint }>>`
      SELECT
        relname as table_name,
        pg_total_relation_size(relid) as size
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 20
    `;

    for (const row of sizeResult) {
      const existing = stats.find((s) => s.name.toLowerCase() === row.table_name.toLowerCase());
      if (existing) {
        existing.sizeBytes = Number(row.size);
      } else {
        stats.push({
          name: row.table_name,
          rowCount: -1,
          sizeBytes: Number(row.size),
        });
      }
    }
  } catch (error) {
    // PostgreSQL-specific query failed, continue without sizes
  }

  return stats.filter((s) => s.rowCount >= 0 || s.sizeBytes);
}

async function benchmarkQuery(
  prisma: PrismaClient,
  name: string,
  queryFn: () => Promise<any>
): Promise<QueryBenchmark> {
  const times: number[] = [];

  for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
    const start = performance.now();
    try {
      await queryFn();
    } catch (error) {
      // Query failed, skip
    }
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  if (times.length === 0) {
    return {
      name,
      query: name,
      avgTime: -1,
      minTime: -1,
      maxTime: -1,
      samples: 0,
    };
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    name,
    query: name,
    avgTime,
    minTime,
    maxTime,
    samples: times.length,
  };
}

async function runQueryBenchmarks(prisma: PrismaClient): Promise<QueryBenchmark[]> {
  const benchmarks: QueryBenchmark[] = [];

  // Benchmark common queries
  const queries: Array<{ name: string; fn: () => Promise<any> }> = [
    {
      name: "Country.findMany (all)",
      fn: () => prisma.country.findMany({ take: 100 }),
    },
    {
      name: "Country.findMany (with select)",
      fn: () =>
        prisma.country.findMany({
          take: 100,
          select: { id: true, name: true, slug: true, flag: true },
        }),
    },
    {
      name: "Country.count",
      fn: () => prisma.country.count(),
    },
    {
      name: "User.findMany (limited)",
      fn: () => prisma.user.findMany({ take: 50 }),
    },
    {
      name: "SystemConfig.findMany",
      fn: () => prisma.systemConfig.findMany(),
    },
    {
      name: "Country aggregate (global stats)",
      fn: () =>
        prisma.country.aggregate({
          _sum: { currentPopulation: true, currentTotalGdp: true },
          _count: true,
        }),
    },
  ];

  for (const query of queries) {
    log(`  Benchmarking: ${query.name}...`, "dim");
    const result = await benchmarkQuery(prisma, query.name, query.fn);
    benchmarks.push(result);
  }

  return benchmarks;
}

function generateRecommendations(
  stats: TableStats[],
  benchmarks: QueryBenchmark[]
): { recommendations: string[]; warnings: string[] } {
  const recommendations: string[] = [];
  const warnings: string[] = [];

  // Check for large tables
  for (const table of stats) {
    if (table.rowCount > 10000) {
      recommendations.push(
        `Table "${table.name}" has ${formatNumber(table.rowCount)} rows - consider pagination and indexing`
      );
    }
    if (table.sizeBytes && table.sizeBytes > 100 * 1024 * 1024) {
      warnings.push(
        `Table "${table.name}" is ${formatBytes(table.sizeBytes)} - consider archiving old data`
      );
    }
  }

  // Check for slow queries
  for (const benchmark of benchmarks) {
    if (benchmark.avgTime > SLOW_QUERY_THRESHOLD) {
      warnings.push(
        `Query "${benchmark.name}" averages ${benchmark.avgTime.toFixed(2)}ms - needs optimization`
      );
    }
    if (benchmark.maxTime > benchmark.avgTime * 3) {
      recommendations.push(
        `Query "${benchmark.name}" has high variance (max: ${benchmark.maxTime.toFixed(2)}ms) - check for lock contention`
      );
    }
  }

  // General recommendations based on patterns
  const countryStats = stats.find((s) => s.name === "Country");
  const auditStats = stats.find((s) => s.name === "AuditLog");

  if (countryStats && countryStats.rowCount > 500) {
    recommendations.push(
      "Consider implementing country data caching for frequently accessed countries"
    );
  }

  if (auditStats && auditStats.rowCount > 100000) {
    recommendations.push("AuditLog table is large - implement log rotation or archival strategy");
  }

  return { recommendations, warnings };
}

// ============================================================================
// Connection Test
// ============================================================================

async function testConnection(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Index Analysis (PostgreSQL)
// ============================================================================

async function analyzeIndexes(
  prisma: PrismaClient
): Promise<Array<{ table: string; index: string; size: string; usage: number }>> {
  try {
    const result = await prisma.$queryRaw<
      Array<{
        tablename: string;
        indexname: string;
        idx_size: bigint;
        idx_scan: bigint;
      }>
    >`
      SELECT
        t.relname as tablename,
        i.relname as indexname,
        pg_relation_size(i.oid) as idx_size,
        COALESCE(idx_stat.idx_scan, 0) as idx_scan
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      LEFT JOIN pg_stat_user_indexes idx_stat ON idx_stat.indexrelid = i.oid
      WHERE t.relkind = 'r'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY pg_relation_size(i.oid) DESC
      LIMIT 20
    `;

    return result.map((row) => ({
      table: row.tablename,
      index: row.indexname,
      size: formatBytes(Number(row.idx_size)),
      usage: Number(row.idx_scan),
    }));
  } catch (error) {
    return [];
  }
}

// ============================================================================
// Main Analysis
// ============================================================================

async function runAnalysis() {
  log("\n═══════════════════════════════════════════════════════════════", "blue");
  log("  IxStats Database Analysis", "blue");
  log("═══════════════════════════════════════════════════════════════\n", "blue");

  const prisma = new PrismaClient({
    log: [{ level: "error", emit: "stdout" }],
  });

  try {
    // Test connection
    log("▸ Testing database connection...", "blue");
    const connected = await testConnection(prisma);

    if (!connected) {
      log("✗ Database connection failed", "red");
      process.exit(1);
    }
    log("✓ Database connected\n", "green");

    // Get table statistics
    log("▸ Analyzing table statistics...", "blue");
    const tableStats = await getTableStats(prisma);

    log("\n  Table Statistics:", "cyan");
    log("  " + "-".repeat(60), "dim");

    for (const table of tableStats.sort((a, b) => b.rowCount - a.rowCount)) {
      const size = table.sizeBytes ? ` (${formatBytes(table.sizeBytes)})` : "";
      const rows = table.rowCount >= 0 ? formatNumber(table.rowCount) : "N/A";
      log(`  ${table.name.padEnd(25)} ${rows.padStart(10)} rows${size}`, "reset");
    }

    // Run query benchmarks
    log("\n▸ Running query benchmarks...", "blue");
    const benchmarks = await runQueryBenchmarks(prisma);

    log("\n  Query Performance:", "cyan");
    log("  " + "-".repeat(60), "dim");

    for (const benchmark of benchmarks.sort((a, b) => b.avgTime - a.avgTime)) {
      const status =
        benchmark.avgTime > SLOW_QUERY_THRESHOLD
          ? colors.red + "SLOW"
          : benchmark.avgTime > SLOW_QUERY_THRESHOLD / 2
            ? colors.yellow + "WARN"
            : colors.green + "GOOD";

      log(
        `  ${benchmark.name.padEnd(35)} ${benchmark.avgTime.toFixed(2).padStart(8)}ms [${status}${colors.reset}]`,
        "reset"
      );
    }

    // Analyze indexes
    log("\n▸ Analyzing indexes...", "blue");
    const indexes = await analyzeIndexes(prisma);

    if (indexes.length > 0) {
      log("\n  Index Statistics:", "cyan");
      log("  " + "-".repeat(60), "dim");

      for (const idx of indexes.slice(0, 10)) {
        const usage = idx.usage === 0 ? colors.yellow + "UNUSED" : `${idx.usage} scans`;
        log(
          `  ${idx.index.substring(0, 35).padEnd(35)} ${idx.size.padStart(10)} [${usage}${colors.reset}]`,
          "reset"
        );
      }
    }

    // Generate recommendations
    log("\n▸ Generating recommendations...", "blue");
    const { recommendations, warnings } = generateRecommendations(tableStats, benchmarks);

    if (warnings.length > 0) {
      log("\n  Warnings:", "yellow");
      for (const warning of warnings) {
        log(`  ⚠ ${warning}`, "yellow");
      }
    }

    if (recommendations.length > 0) {
      log("\n  Recommendations:", "cyan");
      for (const rec of recommendations) {
        log(`  → ${rec}`, "reset");
      }
    }

    if (warnings.length === 0 && recommendations.length === 0) {
      log("\n  ✓ No issues detected", "green");
    }

    // Summary
    log("\n═══════════════════════════════════════════════════════════════", "blue");
    log("  Summary", "blue");
    log("═══════════════════════════════════════════════════════════════\n", "blue");

    const totalRows = tableStats.reduce((sum, t) => sum + (t.rowCount > 0 ? t.rowCount : 0), 0);
    const totalSize = tableStats.reduce((sum, t) => sum + (t.sizeBytes || 0), 0);
    const slowQueries = benchmarks.filter((b) => b.avgTime > SLOW_QUERY_THRESHOLD).length;

    log(`  Tables analyzed:  ${tableStats.length}`, "reset");
    log(`  Total rows:       ${formatNumber(totalRows)}`, "reset");
    if (totalSize > 0) {
      log(`  Total size:       ${formatBytes(totalSize)}`, "reset");
    }
    log(`  Queries tested:   ${benchmarks.length}`, "reset");
    log(`  Slow queries:     ${slowQueries}`, slowQueries > 0 ? "yellow" : "green");
    log(`  Warnings:         ${warnings.length}`, warnings.length > 0 ? "yellow" : "green");
    log("");
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
IxStats Database Analysis

Usage: npx tsx scripts/diagnostics/db-analysis.ts [options]

Options:
  --help, -h     Show this help message

Environment Variables:
  DATABASE_URL   Database connection string (required)

This script analyzes:
  - Table row counts and sizes
  - Query performance benchmarks
  - Index usage statistics
  - Generates optimization recommendations
`);
  process.exit(0);
}

runAnalysis().catch((error) => {
  console.error("Analysis failed:", error.message);
  process.exit(1);
});
