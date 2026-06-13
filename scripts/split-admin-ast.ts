/**
 * One-time AST splitter for the admin mega-router (mirrors split-thinkpages-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in admin/index.ts, so api.admin.* paths are unchanged.
 *
 * Run from the project root:  bun run scripts/split-admin-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/admin.ts";
const outDir = "src/server/api/routers/admin";
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  // Core system config, status, health, stats, logs, calculations, time control.
  system: [
    "getCalculationFormulas",
    "getGlobalStats",
    "getStashStats",
    "getThinkPagesStats",
    "getSystemStatus",
    "getConfig",
    "saveConfig",
    "setCustomTime",
    "getCalculationLogs",
    "forceRecalculation",
    "getSystemHealth",
    "syncEpochWithData",
    "getSystemLogs",
    "clearSystemLogs",
  ],
  // Discord bot control, process management, command/role inspection, sync.
  bot: [
    "getBotStatus",
    "syncBot",
    "pauseBot",
    "resumeBot",
    "clearBotOverrides",
    "getBotProcesses",
    "controlBotProcess",
    "getBotProcessLogs",
    "getBotCommands",
    "getBotRoles",
    "simulateBotCommand",
    "syncWithBot",
  ],
  // User⇄country mapping/assignment and navigation visibility settings.
  users: [
    "listUsersWithCountries",
    "listCountriesWithUsers",
    "assignUserToCountry",
    "unassignUserFromCountry",
    "getNavigationSettings",
    "updateNavigationSettings",
  ],
  // God-mode country data manipulation, roster import, grid/detail, audit, announcements, scenarios.
  countries: [
    "analyzeImport",
    "importRosterData",
    "updateCountryData",
    "bulkUpdateCountries",
    "getAdminAuditLog",
    "createCustomScenario",
    "createGlobalAnnouncement",
    "createMaintenanceNotification",
    "getCountryGrid",
    "getCountryDetail",
  ],
  // Storyteller world events, event chains, diplomatic options, upcoming events.
  worldEvents: [
    "getDiplomaticOptions",
    "createDiplomaticOption",
    "updateDiplomaticOption",
    "deleteDiplomaticOption",
    "bulkToggleDiplomaticOptions",
    "getUpcomingEvents",
    "getWorldEvents",
    "getWorldEventDetail",
    "createWorldEvent",
    "updateWorldEvent",
    "deleteWorldEvent",
    "simulateWorldEvent",
    "getEventChains",
    "createEventChain",
  ],
  // Wiki links, article awards, loreward scoring, MediaWiki templates, cache purges, cron, wiki users.
  wiki: [
    "setWikiLink",
    "bulkSetWikiLinks",
    "resyncWikiCache",
    "createWikiArticleAward",
    "deleteWikiArticleAward",
    "getWikiArticleAwards",
    "triggerLorewardScoring",
    "saveLorewardWinnerOverride",
    "pushLorewardToBot",
    "purgeWikiCache",
    "purgeAllWikiCache",
    "getWikiTemplatesList",
    "getLorewardWeights",
    "saveLorewardWeights",
    "createWikiArticleAwardBatch",
    "evaluateWikiMilestones",
    "previewLorewardScoring",
    "syncWikiTemplateByName",
    "syncWikiTemplatesByCategory",
    "searchMediaWikiTemplates",
    "getCronSchedules",
    "saveCronSchedules",
    "searchWikiUsers",
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The source router carries a dead `/* ... */` block comment with three commented-out
// procedures (getUserCountry/setUserCountry/createUserIfNotExists, disabled "until User
// model is properly configured"). It is NOT a PropertyAssignment, so `.remove()` never
// touches it and copyFileSync carries it into every group file. Strip the exact block so
// each split file is clean and grep-based parity checks don't see phantom procedures.
// Removing inert commented code is behaviour-preserving.
const DEAD_BLOCK = `  // Get the countryId mapped to a Clerk user
  /*
  getUserCountry: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.clerkUserId },
        select: { countryId: true },
      });
      return { countryId: user?.countryId || null };
    }),

  // Set or update the countryId for a Clerk user
  setUserCountry: publicProcedure
    .input(z.object({ clerkUserId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.upsert({
        where: { clerkUserId: input.clerkUserId },
        update: { countryId: input.countryId },
        create: { clerkUserId: input.clerkUserId, countryId: input.countryId },
      });
      return { success: true, user };
    }),

  // Create a user record if it does not exist (on registration)
  createUserIfNotExists: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.upsert({
        where: { clerkUserId: input.clerkUserId },
        update: {},
        create: { clerkUserId: input.clerkUserId },
      });
      return { user };
    }),
  */
`;

// ── Guard 1: DUPLICATE — no procedure may be assigned to two groups.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names from the real router object (AST truth).
const srcSf = project.addSourceFileAtPath(routerFile);
const srcDecl = srcSf.getVariableDeclarationOrThrow("adminRouter");
const srcCall = srcDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const srcObj = srcCall.getArguments()[0] as ObjectLiteralExpression;
const allProps = (
  srcObj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
).map((p) => p.getName());
const allPropsSet = new Set(allProps);
// Done reading source; drop it so the per-group copies start clean.
project.removeSourceFile(srcSf);

// ── Guard 2: NOT-FOUND — every grouped name must exist in the router object.
for (const n of allNames) {
  if (!allPropsSet.has(n)) throw new Error(`Grouped procedure '${n}' not found in router object`);
}

// ── Guard 3: ALL-COVERED — every router procedure must be in some group (prevents silent drops).
const groupedSet = new Set(allNames);
const uncovered = allProps.filter((n) => !groupedSet.has(n));
if (uncovered.length)
  throw new Error(`Uncovered procedures (not in any group): ${uncovered.join(", ")}`);

let totalKept = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.copyFileSync(routerFile, outPath);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("adminRouter");
  decl.rename(`admin${cap(groupName)}Router`);

  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const obj = call.getArguments()[0] as ObjectLiteralExpression;
  const props = obj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];

  const present = new Set(props.map((p) => p.getName()));
  for (const n of names) {
    if (!present.has(n)) throw new Error(`${groupName}: procedure '${n}' not found in router`);
  }

  let kept = 0;
  for (const p of props) {
    if (names.includes(p.getName())) kept++;
    else p.remove();
  }
  sf.saveSync();

  // Strip the dead commented-out procedure block (see DEAD_BLOCK note above).
  const cleaned = fs.readFileSync(outPath, "utf8").replace(DEAD_BLOCK, "");
  if (cleaned.includes("getUserCountry: publicProcedure")) {
    throw new Error(`${groupName}: failed to strip dead procedure comment block`);
  }
  fs.writeFileSync(outPath, cleaned);

  totalKept += kept;
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

// ── Final assertion: kept counts must sum to the total router procedure count.
console.log(`Total kept: ${totalKept} / allProps: ${allProps.length}`);
if (totalKept !== allProps.length) {
  throw new Error(`Kept sum ${totalKept} !== router property count ${allProps.length}`);
}

console.log("Done. Now create admin/index.ts (mergeRouters) and delete admin.ts.");
