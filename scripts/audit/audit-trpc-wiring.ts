#!/usr/bin/env tsx
/**
 * 🔍 IxStats tRPC Wiring Audit Script
 *
 * This script performs a comprehensive audit of:
 * 1. All Prisma database models
 * 2. All tRPC routers and their endpoints (queries/mutations)
 * 3. Cross-references to ensure all database operations are properly wired
 * 4. Identifies missing endpoints, unused models, and coverage gaps
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PrismaModel {
  name: string;
  fields: string[];
  relations: string[];
  lineNumber: number;
}

interface TRPCEndpoint {
  router: string;
  name: string;
  type: "query" | "mutation";
  file: string;
  lineNumber: number;
  usesModel?: string[];
}

interface AuditResults {
  prismaModels: PrismaModel[];
  trpcRouters: {
    name: string;
    file: string;
    endpoints: TRPCEndpoint[];
  }[];
  coverage: {
    model: string;
    hasCreate: boolean;
    hasRead: boolean;
    hasUpdate: boolean;
    hasDelete: boolean;
    hasList: boolean;
    endpoints: string[];
    missingOperations: string[];
  }[];
  unusedModels: string[];
  recommendations: string[];
  stats: {
    totalModels: number;
    totalRouters: number;
    totalEndpoints: number;
    totalQueries: number;
    totalMutations: number;
    fullyCoveredModels: number;
    partiallyCoveredModels: number;
    uncoveredModels: number;
  };
}

const projectRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");
const routersPath = path.join(projectRoot, "src", "server", "api", "routers");

/**
 * Parse Prisma schema to extract all models
 */
function parsePrismaSchema(): PrismaModel[] {
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const lines = schemaContent.split("\n");
  const models: PrismaModel[] = [];

  let currentModel: PrismaModel | null = null;
  let inModel = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Start of model
    if (trimmed.startsWith("model ")) {
      const modelName = trimmed.split(" ")[1];
      currentModel = {
        name: modelName,
        fields: [],
        relations: [],
        lineNumber: index + 1,
      };
      inModel = true;
    }

    // End of model
    else if (inModel && trimmed === "}") {
      if (currentModel) {
        models.push(currentModel);
      }
      currentModel = null;
      inModel = false;
    }

    // Field within model
    else if (
      inModel &&
      currentModel &&
      trimmed &&
      !trimmed.startsWith("@@") &&
      !trimmed.startsWith("//")
    ) {
      const fieldName = trimmed.split(/\s+/)[0];
      if (fieldName && !fieldName.startsWith("@")) {
        currentModel.fields.push(fieldName);

        // Check if it's a relation
        if (trimmed.includes("@relation")) {
          currentModel.relations.push(fieldName);
        }
      }
    }
  });

  return models;
}

/**
 * Parse all tRPC routers to extract endpoints
 */
async function parseTRPCRouters(): Promise<
  { name: string; file: string; endpoints: TRPCEndpoint[] }[]
> {
  const routerFiles = await glob("**/*.ts", { cwd: routersPath, absolute: true });
  const routers: { name: string; file: string; endpoints: TRPCEndpoint[] }[] = [];

  for (const file of routerFiles) {
    // Skip .full files and backup files
    if (file.includes(".full") || file.includes(".backup") || file.includes(".bak")) {
      continue;
    }

    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    const routerName = path.basename(file, ".ts");
    const endpoints: TRPCEndpoint[] = [];

    // Check if this file actually exports a router
    const hasRouterExport = content.includes(`export const ${routerName}Router`);
    if (!hasRouterExport) {
      continue;
    }

    // Parse for .query( and .mutation( patterns with improved regex
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmed = line.trim();

      // Match query definitions - improved pattern
      const queryMatch = trimmed.match(/^(\w+):\s*(?:public|protected|admin)Procedure/);
      if (queryMatch) {
        // Look ahead to see if it's a query or mutation
        const lookAhead = lines.slice(index, Math.min(index + 10, lines.length)).join(" ");
        if (lookAhead.includes(".query(")) {
          endpoints.push({
            router: routerName,
            name: queryMatch[1],
            type: "query",
            file: path.relative(projectRoot, file),
            lineNumber: index + 1,
            usesModel: findModelsInEndpoint(content, index),
          });
        } else if (lookAhead.includes(".mutation(")) {
          endpoints.push({
            router: routerName,
            name: queryMatch[1],
            type: "mutation",
            file: path.relative(projectRoot, file),
            lineNumber: index + 1,
            usesModel: findModelsInEndpoint(content, index),
          });
        }
      }
    }

    if (endpoints.length > 0) {
      routers.push({
        name: routerName,
        file: path.relative(projectRoot, file),
        endpoints,
      });
    }
  }

  return routers;
}

/**
 * Find which Prisma models are used in an endpoint
 * Now includes indirect usage through includes and relations
 */
function findModelsInEndpoint(content: string, startLine: number): string[] {
  const models = new Set<string>();
  const lines = content.split("\n");

  // Look at the endpoint and surrounding context (next 150 lines to capture full endpoint)
  const endLine = Math.min(startLine + 150, lines.length);
  const contextLines = lines.slice(startLine, endLine).join("\n");

  // 1. Match direct ctx.db.modelName patterns (handles both camelCase and PascalCase)
  const dbMatches = contextLines.matchAll(/(?:ctx\.)?db\.(\w+)\./g);
  for (const match of dbMatches) {
    // Capitalize first letter to match Prisma model naming
    const dbName = match[1];
    const modelName = dbName.charAt(0).toUpperCase() + dbName.slice(1);
    models.add(modelName);
  }

  // 2. Match include patterns to find indirectly used models
  // Pattern: include: { modelName: true } or include: { modelName: { ... } }
  const includeMatches = contextLines.matchAll(/include:\s*\{[^}]*?(\w+):\s*(?:true|\{)/g);
  for (const match of includeMatches) {
    const modelName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    // Common relation names that map to models
    if (modelName !== "Include" && modelName !== "Where" && modelName !== "Select") {
      models.add(modelName);
    }
  }

  // 3. Match nested include patterns for deeper relations
  const nestedIncludeMatches = contextLines.matchAll(/(\w+):\s*\{[^}]*?include:\s*\{/g);
  for (const match of nestedIncludeMatches) {
    const modelName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    if (modelName !== "Include" && modelName !== "Where" && modelName !== "Select") {
      models.add(modelName);
    }
  }

  // 4. Match _count patterns which indicate related models
  const countMatches = contextLines.matchAll(/_count:\s*\{[^}]*?select:\s*\{[^}]*?(\w+):/g);
  for (const match of countMatches) {
    const modelName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    models.add(modelName);
  }

  // 5. Match createMany/create with nested data patterns
  const createMatches = contextLines.matchAll(/(\w+):\s*\{[^}]*?(?:create|createMany):/g);
  for (const match of createMatches) {
    const modelName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    if (modelName !== "Data" && modelName !== "Include") {
      models.add(modelName);
    }
  }

  return Array.from(models);
}

/**
 * Analyze coverage for each model
 * Enhanced to detect indirect usage through relations
 */
function analyzeCoverage(
  models: PrismaModel[],
  routers: { name: string; file: string; endpoints: TRPCEndpoint[] }[]
): AuditResults["coverage"] {
  const coverage: AuditResults["coverage"] = [];

  // Build a map of model relations for indirect detection
  const relationMap = new Map<string, string[]>();
  for (const model of models) {
    relationMap.set(model.name, model.relations);
  }

  for (const model of models) {
    const modelName = model.name;
    const lowerModelName = modelName.toLowerCase();

    const relatedEndpoints: TRPCEndpoint[] = [];

    // Find all endpoints that use this model (directly or indirectly)
    for (const router of routers) {
      for (const endpoint of router.endpoints) {
        // Direct usage
        if (endpoint.usesModel?.includes(modelName)) {
          relatedEndpoints.push(endpoint);
          continue;
        }

        // Indirect usage: check if endpoint uses a model that relates to this model
        const usedModels = endpoint.usesModel || [];
        for (const usedModel of usedModels) {
          const relations = relationMap.get(usedModel) || [];
          // Check if any relation field name matches our model (case-insensitive)
          const hasRelation = relations.some(
            (rel) =>
              rel.toLowerCase() === lowerModelName ||
              rel.toLowerCase() === lowerModelName + "s" ||
              rel.toLowerCase().startsWith(lowerModelName)
          );
          if (hasRelation) {
            relatedEndpoints.push(endpoint);
            break;
          }
        }
      }
    }

    // Remove duplicates
    const uniqueEndpoints = Array.from(
      new Set(relatedEndpoints.map((e) => `${e.router}.${e.name}`))
    ).map((key) => relatedEndpoints.find((e) => `${e.router}.${e.name}` === key)!);

    // Check for CRUD operations with enhanced patterns
    const hasCreate = uniqueEndpoints.some(
      (e) =>
        e.type === "mutation" &&
        (e.name.toLowerCase().includes("create") ||
          e.name.toLowerCase().includes("add") ||
          e.name.toLowerCase().includes("insert") ||
          e.name.toLowerCase().includes("new"))
    );

    const hasRead = uniqueEndpoints.some(
      (e) =>
        e.type === "query" &&
        (e.name.toLowerCase().includes("get") ||
          e.name.toLowerCase().includes("find") ||
          e.name.toLowerCase().includes("fetch") ||
          e.name.toLowerCase().includes("read") ||
          e.name.toLowerCase().includes("show"))
    );

    const hasUpdate = uniqueEndpoints.some(
      (e) =>
        e.type === "mutation" &&
        (e.name.toLowerCase().includes("update") ||
          e.name.toLowerCase().includes("edit") ||
          e.name.toLowerCase().includes("modify") ||
          e.name.toLowerCase().includes("change") ||
          e.name.toLowerCase().includes("set"))
    );

    const hasDelete = uniqueEndpoints.some(
      (e) =>
        e.type === "mutation" &&
        (e.name.toLowerCase().includes("delete") ||
          e.name.toLowerCase().includes("remove") ||
          e.name.toLowerCase().includes("destroy"))
    );

    const hasList = uniqueEndpoints.some(
      (e) =>
        e.type === "query" &&
        (e.name.toLowerCase().includes("list") ||
          e.name.toLowerCase().includes("all") ||
          e.name.toLowerCase().includes("many") ||
          e.name.toLowerCase().includes("search") ||
          e.name.toLowerCase().includes("feed"))
    );

    const missingOperations: string[] = [];
    if (!hasCreate) missingOperations.push("CREATE");
    if (!hasRead) missingOperations.push("READ");
    if (!hasUpdate) missingOperations.push("UPDATE");
    if (!hasDelete) missingOperations.push("DELETE");
    if (!hasList) missingOperations.push("LIST");

    coverage.push({
      model: modelName,
      hasCreate,
      hasRead,
      hasUpdate,
      hasDelete,
      hasList,
      endpoints: uniqueEndpoints.map((e) => `${e.router}.${e.name} (${e.type})`),
      missingOperations,
    });
  }

  return coverage;
}

/**
 * Generate recommendations based on audit findings
 */
function generateRecommendations(
  coverage: AuditResults["coverage"],
  models: PrismaModel[]
): string[] {
  const recommendations: string[] = [];

  // High-priority models that should have full CRUD
  const highPriorityModels = [
    "Country",
    "User",
    "EconomicData",
    "GovernmentStructure",
    "DiplomaticRelation",
    "ThinkPage",
    "Achievement",
    "SecurityForce",
  ];

  for (const item of coverage) {
    const isHighPriority = highPriorityModels.includes(item.model);

    if (item.endpoints.length === 0) {
      recommendations.push(
        `⚠️  CRITICAL: Model "${item.model}" has NO endpoints - completely unwired!`
      );
    } else if (isHighPriority && item.missingOperations.length > 0) {
      recommendations.push(
        `⚠️  HIGH: Model "${item.model}" is high-priority but missing: ${item.missingOperations.join(", ")}`
      );
    } else if (item.missingOperations.length >= 4) {
      recommendations.push(
        `⚠️  MEDIUM: Model "${item.model}" has minimal coverage (missing: ${item.missingOperations.join(", ")})`
      );
    }
  }

  // Check for junction/relation tables
  const junctionModels = models.filter((m) => m.relations.length >= 2 && m.fields.length <= 5);

  for (const junction of junctionModels) {
    const junctionCoverage = coverage.find((c) => c.model === junction.name);
    if (junctionCoverage && !junctionCoverage.hasCreate) {
      recommendations.push(
        `💡 INFO: Junction table "${junction.name}" might need CREATE mutation for relationship management`
      );
    }
  }

  return recommendations;
}

/**
 * Main audit function
 */
async function runAudit(): Promise<AuditResults> {
  console.log("🔍 Starting IxStats tRPC Wiring Audit...\n");

  console.log("📊 Parsing Prisma schema...");
  const prismaModels = parsePrismaSchema();
  console.log(`   Found ${prismaModels.length} models\n`);

  console.log("🔌 Parsing tRPC routers...");
  const trpcRouters = await parseTRPCRouters();
  const totalEndpoints = trpcRouters.reduce((sum, r) => sum + r.endpoints.length, 0);
  console.log(`   Found ${trpcRouters.length} routers with ${totalEndpoints} endpoints\n`);

  console.log("🔗 Analyzing coverage...");
  const coverage = analyzeCoverage(prismaModels, trpcRouters);

  const fullyCovered = coverage.filter((c) => c.missingOperations.length === 0).length;
  const partiallyCovered = coverage.filter(
    (c) => c.missingOperations.length > 0 && c.endpoints.length > 0
  ).length;
  const uncovered = coverage.filter((c) => c.endpoints.length === 0).length;

  console.log(`   ✅ Fully covered: ${fullyCovered}`);
  console.log(`   ⚠️  Partially covered: ${partiallyCovered}`);
  console.log(`   ❌ Uncovered: ${uncovered}\n`);

  const unusedModels = coverage.filter((c) => c.endpoints.length === 0).map((c) => c.model);
  const recommendations = generateRecommendations(coverage, prismaModels);

  const totalQueries = trpcRouters.reduce(
    (sum, r) => sum + r.endpoints.filter((e) => e.type === "query").length,
    0
  );
  const totalMutations = trpcRouters.reduce(
    (sum, r) => sum + r.endpoints.filter((e) => e.type === "mutation").length,
    0
  );

  return {
    prismaModels,
    trpcRouters,
    coverage,
    unusedModels,
    recommendations,
    stats: {
      totalModels: prismaModels.length,
      totalRouters: trpcRouters.length,
      totalEndpoints,
      totalQueries,
      totalMutations,
      fullyCoveredModels: fullyCovered,
      partiallyCoveredModels: partiallyCovered,
      uncoveredModels: uncovered,
    },
  };
}

/**
 * Format and display results
 */
function displayResults(results: AuditResults) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📊 AUDIT RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("📈 STATISTICS:");
  console.log(`   Total Prisma Models: ${results.stats.totalModels}`);
  console.log(`   Total tRPC Routers: ${results.stats.totalRouters}`);
  console.log(`   Total Endpoints: ${results.stats.totalEndpoints}`);
  console.log(`     - Queries: ${results.stats.totalQueries}`);
  console.log(`     - Mutations: ${results.stats.totalMutations}`);
  console.log(`   Model Coverage:`);
  console.log(
    `     - Fully Covered: ${results.stats.fullyCoveredModels} (${Math.round((results.stats.fullyCoveredModels / results.stats.totalModels) * 100)}%)`
  );
  console.log(
    `     - Partially Covered: ${results.stats.partiallyCoveredModels} (${Math.round((results.stats.partiallyCoveredModels / results.stats.totalModels) * 100)}%)`
  );
  console.log(
    `     - Uncovered: ${results.stats.uncoveredModels} (${Math.round((results.stats.uncoveredModels / results.stats.totalModels) * 100)}%)`
  );
  console.log("");

  // Display uncovered models
  if (results.unusedModels.length > 0) {
    console.log("❌ COMPLETELY UNWIRED MODELS:");
    results.unusedModels.forEach((model) => {
      console.log(`   - ${model}`);
    });
    console.log("");
  }

  // Display recommendations
  if (results.recommendations.length > 0) {
    console.log("💡 RECOMMENDATIONS:");
    results.recommendations.forEach((rec) => {
      console.log(`   ${rec}`);
    });
    console.log("");
  }

  // Display detailed coverage
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📋 DETAILED COVERAGE REPORT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  results.coverage.forEach((item) => {
    const status =
      item.endpoints.length === 0 ? "❌" : item.missingOperations.length === 0 ? "✅" : "⚠️";

    console.log(`${status} ${item.model}`);
    console.log(
      `   CRUD: [${item.hasCreate ? "✓" : "✗"}] Create | [${item.hasRead ? "✓" : "✗"}] Read | [${item.hasUpdate ? "✓" : "✗"}] Update | [${item.hasDelete ? "✓" : "✗"}] Delete | [${item.hasList ? "✓" : "✗"}] List`
    );

    if (item.endpoints.length > 0) {
      console.log(`   Endpoints (${item.endpoints.length}):`);
      item.endpoints.forEach((endpoint) => {
        console.log(`     - ${endpoint}`);
      });
    } else {
      console.log(`   ⚠️  NO ENDPOINTS FOUND`);
    }

    if (item.missingOperations.length > 0) {
      console.log(`   Missing: ${item.missingOperations.join(", ")}`);
    }
    console.log("");
  });

  // Router breakdown
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🔌 ROUTER BREAKDOWN");
  console.log("═══════════════════════════════════════════════════════════════\n");

  results.trpcRouters.forEach((router) => {
    const queries = router.endpoints.filter((e) => e.type === "query").length;
    const mutations = router.endpoints.filter((e) => e.type === "mutation").length;

    console.log(
      `📁 ${router.name} (${router.endpoints.length} endpoints: ${queries} queries, ${mutations} mutations)`
    );
    console.log(`   File: ${router.file}`);

    if (router.endpoints.length > 0) {
      const grouped = router.endpoints.reduce(
        (acc, e) => {
          if (!acc[e.type]) acc[e.type] = [];
          acc[e.type].push(e);
          return acc;
        },
        {} as Record<string, TRPCEndpoint[]>
      );

      if (grouped.query) {
        console.log(`   Queries:`);
        grouped.query.forEach((e) => {
          const models =
            e.usesModel && e.usesModel.length > 0 ? ` [${e.usesModel.join(", ")}]` : "";
          console.log(`     - ${e.name}${models}`);
        });
      }

      if (grouped.mutation) {
        console.log(`   Mutations:`);
        grouped.mutation.forEach((e) => {
          const models =
            e.usesModel && e.usesModel.length > 0 ? ` [${e.usesModel.join(", ")}]` : "";
          console.log(`     - ${e.name}${models}`);
        });
      }
    }
    console.log("");
  });
}

/**
 * Save results to JSON file
 */
function saveResults(results: AuditResults) {
  const outputPath = path.join(
    projectRoot,
    `audit-results-${new Date().toISOString().split("T")[0]}.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full results saved to: ${path.relative(projectRoot, outputPath)}\n`);
}

/**
 * Run the audit
 */
async function main() {
  try {
    const results = await runAudit();
    displayResults(results);
    saveResults(results);

    console.log("✅ Audit complete!\n");

    // Exit with error code if there are critical issues (configurable)
    const failOnUnwired = process.env.WIRING_FAIL_ON_UNWIRED !== "false";
    if (results.unusedModels.length > 0) {
      console.log("⚠️  WARNING: Found completely unwired models. Review recommendations above.\n");
      if (failOnUnwired) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("❌ Audit failed:", error);
    process.exit(1);
  }
}

main();
