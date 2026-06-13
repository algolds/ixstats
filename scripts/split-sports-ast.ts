/**
 * One-time AST splitter for the sports mega-router (mirrors split-thinkpages-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in sports/index.ts, so api.sports.* paths are unchanged.
 *
 * Run from the project root:  bun run scripts/split-sports-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/sports.ts";
const outDir = "src/server/api/routers/sports";
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  leagues: [
    "createLeague",
    "updateLeague",
    "deleteLeague",
    "getLeague",
    "getLeagues",
    "getDraftPicks",
    "getSchedule",
    "getSportPresets",
    "searchSportsEntities",
  ],
  teams: [
    "getTeams",
    "getTeam",
    "updateTeam",
    "claimTeam",
    "updateTeamTactics",
    "selectSponsor",
    "trainPlayer",
    "teamTraining",
    "setLineup",
    "getMyClubs",
    "getMyClubOverview",
  ],
  seasons: [
    "startSeason",
    "getSeason",
    "simulateMatchDay",
    "simulatePlayoffRound",
    "simulateFullSeason",
    "transitionToNextSeason",
    "simulateRace",
    "getMatchDetails",
    "collectMatchRevenue",
  ],
  standings: [
    "getStandings",
    "getBracket",
    "getRaceResults",
    "getLeagueHistory",
    "getTeamHistory",
    "getRecords",
  ],
  transfers: [
    "listPlayerForTransfer",
    "placeTransferBid",
    "respondToTransferBid",
    "getPlayerValuation",
    "getOpenTransferListings",
    "getTeamBids",
  ],
  club: ["upgradeStadium", "setTicketPrice", "invokePatronSaint"],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

// Collect ALL PropertyAssignment names in the router object (source of truth).
const baseFile = project.addSourceFileAtPath(routerFile);
const baseDecl = baseFile.getVariableDeclarationOrThrow("sportsRouter");
const baseCall = baseDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
const baseObj = baseCall.getArguments()[0] as ObjectLiteralExpression;
const allProps = (
  baseObj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[]
).map((p) => p.getName());
const allPropsSet = new Set(allProps);

// NOT-FOUND guard: every grouped name must exist in the router object.
for (const n of allNames) {
  if (!allPropsSet.has(n)) throw new Error(`Grouped procedure '${n}' not found in router object`);
}

// ALL-COVERED guard: every router procedure must be assigned to some group.
const allNamesSet = new Set(allNames);
const uncovered = allProps.filter((n) => !allNamesSet.has(n));
if (uncovered.length)
  throw new Error(`Uncovered procedures (would be silently dropped): ${uncovered.join(", ")}`);

// Drop the base file from the project before writing per-group copies.
project.removeSourceFile(baseFile);

let totalKept = 0;
for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.copyFileSync(routerFile, outPath);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("sportsRouter");
  decl.rename(`sports${cap(groupName)}Router`);

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
  totalKept += kept;
  sf.saveSync();
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

// Final assertion: sum of kept must equal the total number of router procedures.
if (totalKept !== allProps.length) {
  throw new Error(`Kept ${totalKept} procedures but router has ${allProps.length} — mismatch!`);
}
console.log(`Total kept: ${totalKept}/${allProps.length} (parity OK)`);
console.log("Done. Now create sports/index.ts (mergeRouters) and delete sports.ts.");
