/**
 * scripts/audit/wikios-mode-switch.ts — do mode switches and visual edits keep every page's wikitext?
 *
 * For every page of the local corpus (`wiki_articles.wikitext`, read-only), using the checks in
 * wikios-mode-switch-checks.ts (which model what WikiEditBridge / WikiVisualEditor / PlateWikiEditor really do):
 *   cycles      source -> visual -> source, `--cycles` times (default 3), each from the text the last one wrote: every
 *               cycle must write the original back, and every load must give the same Plate content (fingerprints).
 *   normalised  Slate's full normalisation of the loaded page (what an edit runs on the paths it touches) writes the
 *               original back.
 *   edits       one character typed at the end of up to `--edits` (default 8) blocks, list items and table cells,
 *               spread over the page, in a Slate editor configured like the Plate one: the output must be the original
 *               with that one character added (`local`), and loading the edited output and writing it again must give
 *               the same text (`stable`, the switch to source and back after an edit).
 *
 * Usage:
 *   DATABASE_URL=postgresql://…@localhost:5433/ixstats_proof?… bun scripts/audit/wikios-mode-switch.ts \
 *     [--namespaces all|n,n] [--limit N] [--cycles 3] [--edits 8] [--out .bench-out/mode-switch.json]
 *
 * DATABASE_URL must be set explicitly (no .env file is read) to a local clone: localhost, never the production tunnel on
 * 15433, never the `ixstats` database itself. The script never writes. `--limit` (default
 * 1000000) takes that many pages spread evenly over the selection. Exit code is 1 when any check failed.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  ensureParentDir,
  exitWithError,
  isLocalDatabaseUrl,
  lineDiff,
  parseNamespaces,
  samplePages,
} from "../lib/wikios-harness";
import {
  checkCycles,
  checkEdit,
  editableUnits,
  loadInEditor,
  normalisedSave,
  spread,
  type EditOutcome,
} from "./wikios-mode-switch-checks";

interface Config {
  namespaces: number[] | "all";
  limit: number;
  cycles: number;
  edits: number;
  out: string;
}

interface PageInput {
  title: string;
  wikitext: string;
}

interface PageFailure {
  title: string;
  /**
   * `edit-rewrite` is not a failure: the edited block was written differently but reads the same (an open quote mark
   * closed at the end of its line, cell spacing). `edit-different` reads differently, `edit-spill` changed text outside
   * the edited block.
   */
  check:
    | "cycles"
    | "tree"
    | "normalised"
    | "edit-rewrite"
    | "edit-different"
    | "edit-spill"
    | "edit-mark"
    | "edit-stable"
    | "error";
  kind?: string;
  diff: string[];
}

interface Totals {
  pages: number;
  cyclesOk: number;
  treeStable: number;
  normalisedOk: number;
  edits: number;
  editsLocal: number;
  editsEquivalent: number;
  editsConfined: number;
  editsMarkOnce: number;
  editsStable: number;
  editsByKind: Record<string, { total: number; local: number; equivalent: number; stable: number }>;
  /** Pages skipped because their content model is not wikitext (CSS, JavaScript, JSON, Lua modules). */
  notWikitext: number;
}

/** Pages whose content model is not wikitext: the editor opens them in source mode only. */
const NOT_WIKITEXT = /^Module:|\.(?:css|js|json)$/i;

const USAGE =
  "Usage: bun scripts/audit/wikios-mode-switch.ts [--namespaces all|n,n] [--limit N] [--cycles N] [--edits N] [--out file]";

function positive(value: string | undefined, fallback: number, flag: string): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!(parsed >= 1)) throw new Error(`${flag} must be >= 1`);
  return parsed;
}

function parseConfig(argv: string[]): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      namespaces: { type: "string" },
      limit: { type: "string" },
      cycles: { type: "string" },
      edits: { type: "string" },
      out: { type: "string" },
    },
  });
  return {
    namespaces: parseNamespaces(values.namespaces ?? "all"),
    limit: positive(values.limit, 1_000_000, "--limit"),
    cycles: positive(values.cycles, 3, "--cycles"),
    edits: positive(values.edits, 8, "--edits"),
    out: values.out ?? ".bench-out/mode-switch.json",
  };
}

/** Reads wikitext from the local database only. Never writes. */
async function loadPages(config: Config): Promise<PageInput[]> {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!isLocalDatabaseUrl(databaseUrl))
    throw new Error("DATABASE_URL does not point at a local database; refusing.");
  // The `ixstats` database mirrors production data: the corpus is read from a clone (ixstats_proof, ixstats_wv1).
  if (new URL(databaseUrl).pathname === "/ixstats")
    throw new Error("DATABASE_URL names `ixstats`; use a clone such as ixstats_proof.");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const { namespaces } = config;
    const where = {
      source: "ixwiki",
      ...(namespaces === "all" ? {} : { namespace: { in: namespaces } }),
    };
    const ids = await prisma.wikiArticle.findMany({
      where,
      select: { id: true },
      orderBy: { title: "asc" },
    });
    return await prisma.wikiArticle.findMany({
      where: {
        id: {
          in: samplePages(
            ids.map((row) => row.id),
            config.limit
          ),
        },
      },
      select: { title: true, wikitext: true },
      orderBy: { title: "asc" },
    });
  } finally {
    await prisma.$disconnect();
  }
}

const preview = (input: string, output: string): string[] =>
  lineDiff(input, output)
    .changes.slice(0, 12)
    .map(
      (change) =>
        `${change.kind} ${String(change.lineNo).padStart(5)}: ${JSON.stringify(change.line.slice(0, 160))}`
    );

function recordEdit(totals: Totals, outcome: EditOutcome): void {
  const count = (flag: boolean): number => (flag ? 1 : 0);
  totals.edits += 1;
  totals.editsLocal += count(outcome.local);
  totals.editsEquivalent += count(outcome.local || outcome.equivalent);
  totals.editsConfined += count(outcome.confined);
  totals.editsMarkOnce += count(outcome.markOnce);
  totals.editsStable += count(outcome.stableAfter);
  const entry = totals.editsByKind[outcome.kind] ?? {
    total: 0,
    local: 0,
    equivalent: 0,
    stable: 0,
  };
  entry.total += 1;
  entry.local += count(outcome.local);
  entry.equivalent += count(outcome.local || outcome.equivalent);
  entry.stable += count(outcome.stableAfter);
  totals.editsByKind[outcome.kind] = entry;
}

function editFailures(page: PageInput, outcome: EditOutcome): PageFailure[] {
  const failures: PageFailure[] = [];
  const base = { title: page.title, kind: outcome.kind };
  const diff = (): string[] => preview(page.wikitext, outcome.output);
  if (!outcome.confined) failures.push({ ...base, check: "edit-spill", diff: diff() });
  if (!outcome.local)
    failures.push({
      ...base,
      check: outcome.equivalent ? "edit-rewrite" : "edit-different",
      diff: diff(),
    });
  if (!outcome.markOnce) failures.push({ ...base, check: "edit-mark", diff: [] });
  if (!outcome.stableAfter) failures.push({ ...base, check: "edit-stable", diff: [] });
  return failures;
}

function checkPage(page: PageInput, config: Config, totals: Totals): PageFailure[] {
  const failures: PageFailure[] = [];
  const cycles = checkCycles(page.wikitext, config.cycles);
  if (cycles.fixedPoint) totals.cyclesOk += 1;
  else
    failures.push({
      title: page.title,
      check: "cycles",
      diff: preview(page.wikitext, cycles.firstDifferent ?? ""),
    });
  if (cycles.stableTree) totals.treeStable += 1;
  else failures.push({ title: page.title, check: "tree", diff: [] });

  const normalised = normalisedSave(page.wikitext);
  if (normalised === page.wikitext) totals.normalisedOk += 1;
  else
    failures.push({
      title: page.title,
      check: "normalised",
      diff: preview(page.wikitext, normalised),
    });

  const nodes = loadInEditor(page.wikitext);
  for (const unit of spread(editableUnits(nodes), config.edits)) {
    const outcome = checkEdit(page.wikitext, nodes, unit);
    recordEdit(totals, outcome);
    failures.push(...editFailures(page, outcome));
  }
  return failures;
}

const percent = (part: number, whole: number): string =>
  whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(2)}%`;

function renderTotals(totals: Totals, failures: PageFailure[]): string {
  const lines = [
    "## Aggregate",
    `Pages: ${totals.pages} (pipeline errors: ${failures.filter((f) => f.check === "error").length})`,
    `Cycles back to the original: ${totals.cyclesOk}/${totals.pages} (${percent(totals.cyclesOk, totals.pages)})`,
    `Plate content stable across cycles: ${totals.treeStable}/${totals.pages}`,
    `Slate-normalised save identical: ${totals.normalisedOk}/${totals.pages}`,
    `Skipped, not wikitext (CSS/JS/JSON/Lua): ${totals.notWikitext}`,
    `Edits: ${totals.edits}`,
    `  byte-local (output = original + the typed character): ${totals.editsLocal} (${percent(totals.editsLocal, totals.edits)})`,
    `  local or reads the same: ${totals.editsEquivalent} (${percent(totals.editsEquivalent, totals.edits)})`,
    `  nothing outside the edited block changed: ${totals.editsConfined} (${percent(totals.editsConfined, totals.edits)})`,
    `  typed character once: ${totals.editsMarkOnce}; stable after a switch: ${totals.editsStable} (${percent(totals.editsStable, totals.edits)})`,
    "Edits by unit (byte-local / reads the same / stable / total):",
  ];
  for (const [kind, entry] of Object.entries(totals.editsByKind).sort()) {
    lines.push(
      `  ${kind.padEnd(11)} ${entry.local} / ${entry.equivalent} / ${entry.stable} / ${entry.total}`
    );
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  let config: Config;
  try {
    config = parseConfig(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exit(1);
  }
  const pages = (await loadPages(config)).filter((page) => page.wikitext.trim() !== "");
  const totals: Totals = {
    pages: 0,
    cyclesOk: 0,
    treeStable: 0,
    normalisedOk: 0,
    edits: 0,
    editsLocal: 0,
    editsEquivalent: 0,
    editsConfined: 0,
    editsMarkOnce: 0,
    editsStable: 0,
    editsByKind: {},
    notWikitext: 0,
  };
  const failures: PageFailure[] = [];
  for (const page of pages) {
    if (NOT_WIKITEXT.test(page.title)) {
      totals.notWikitext += 1;
      continue;
    }
    // Slate flushes each editor's operations in a microtask: yield so that they run and the editors can be collected.
    await new Promise((resolve) => setImmediate(resolve));
    totals.pages += 1;
    try {
      failures.push(...checkPage(page, config, totals));
    } catch (error) {
      failures.push({
        title: page.title,
        check: "error",
        diff: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  console.log(`# WikiOS mode switch and edit fidelity — ${totals.pages} pages\n`);
  for (const failure of failures.filter((f) => f.check !== "edit-rewrite")) {
    console.log(
      `FAIL  ${failure.check}${failure.kind ? ` (${failure.kind})` : ""}  ${failure.title}`
    );
    for (const line of failure.diff) console.log(`      ${line}`);
  }
  console.log(`\n${renderTotals(totals, failures)}`);
  ensureParentDir(config.out);
  writeFileSync(
    config.out,
    JSON.stringify(
      { meta: { ...config, generatedAt: new Date().toISOString() }, totals, failures },
      null,
      2
    )
  );
  console.log(`\nFull results written to ${config.out}`);
  if (failures.some((failure) => failure.check !== "edit-rewrite")) process.exitCode = 1;
}

main().catch(exitWithError);
