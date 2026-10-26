// scripts/defense/reset-starter-forces.ts
/**
 * Realm time D2a: reset every nation's forces to a starter force under the defense model (owner decision). A starter
 * force is the equilibrium of the nation's current defense budget (the Defense department lines, else the builder's
 * Defense figure, else the government form's share of spending, else 2% of GDP): personnel from the budget split and
 * pay within the manpower pool, reserves at their steady state, capital as the accumulated depreciated procurement of
 * that budget, readiness at what O&M sustains. Players keep their branches' names, mottos, images and units; NPCs get
 * forces from their economy. The model is `~/lib/military/model` (`starterNation`); the writer is the defense
 * module's `ensureStarterForce`, the same path a nation's first read takes.
 *
 *   bun scripts/defense/reset-starter-forces.ts                          # dry run: DDL + reset in one transaction, rolled back
 *   bun scripts/defense/reset-starter-forces.ts --apply --i-know ixstats # after d2a and d3: reset every nation
 *
 * Other flags: --country <id> (one nation), --show <name,name> (nations to print in full; default a sample).
 * Database guard: it runs only on a clone named in CLONE_DATABASES, or with `--i-know <database>` naming the database
 * it is connected to (the runbook passes `--i-know ixstats`), so a stray DATABASE_URL never resets the wrong one.
 * Idempotent: a nation that already has a DefensePolicy is skipped, so a re-run (or a nation that was read by the new
 * build first) changes nothing. The dry run applies `d2a-defense-model.sql` and `d3-combat.sql` (the defense policy's
 * D3 columns, which the generated client reads) from `scripts/migrations/2026-10-realm-time/` inside the same
 * transaction first, so it runs against a database that has had neither, and rolls everything back.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { syncDefense } from "~/server/modules/defense";

const SQL_DIR = join(__dirname, "../migrations/2026-10-realm-time");
/** The SQL the reset needs before it runs, in order: the defense model, then D3's policy columns. */
export const DRY_RUN_SQL = ["d2a-defense-model.sql", "d3-combat.sql"] as const;
/** Clones the reset may run on without `--i-know`. */
export const CLONE_DATABASES: readonly string[] = ["ixstats_wv1", "ixstats_dryrun", "ixstats_scenarios"];
const BAND = { min: 0.002, max: 0.011 };

class RolledBack extends Error {}

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

/** The SQL file's statements without its BEGIN/COMMIT and final report SELECT (`;` inside `$$` blocks kept). */
export function sqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollar = false;
  for (const line of sql.split("\n")) {
    if (!inDollar && /^\s*--/.test(line)) continue;
    current += `${line}\n`;
    if ((line.match(/\$\$/g)?.length ?? 0) % 2 === 1) inDollar = !inDollar;
    if (!inDollar && /;\s*$/.test(line)) {
      statements.push(current.trim());
      current = "";
    }
  }
  return statements.filter((s) => !/^(BEGIN|COMMIT);$/i.test(s) && !/^SELECT\b/i.test(s));
}

/** Why the reset must not run on `database` with these arguments, or null when it may. */
export function resetRefusal(database: string, argv: readonly string[]): string | null {
  if (CLONE_DATABASES.includes(database)) return null;
  const i = argv.indexOf("--i-know");
  const confirmed = i >= 0 ? argv[i + 1] : undefined;
  if (confirmed === database) return null;
  return confirmed === undefined
    ? `Refusing to run on "${database}": it is not a known clone. Pass --i-know ${database} if that is intended.`
    : `Refusing to run on "${database}": --i-know names "${confirmed}".`;
}

export interface Row {
  name: string;
  population: number;
  gdpPerCapita: number;
  budget: number;
  burden: number;
  source: string;
  active: number;
  activeShare: number;
  reserves: number;
  capitalBn: number;
  readiness: number;
  cLevel: string;
  combatPower: number;
  branches: string;
}

async function resetCountry(db: Prisma.TransactionClient, id: string): Promise<Row | null> {
  if (await db.defensePolicy.findUnique({ where: { countryId: id }, select: { id: true } })) return null;
  const snap = await syncDefense(db, id);
  const active = snap.state.branches.reduce((s, b) => s + b.active, 0);
  const reserves = snap.state.branches.reduce((s, b) => s + b.reserves, 0);
  const capital = snap.state.branches.reduce((s, b) => s + b.capital, 0);
  return {
    name: snap.country.name,
    population: snap.econ.population,
    gdpPerCapita: snap.econ.gdpPerCapita,
    budget: snap.econ.defenseBudget,
    burden: snap.view.burden,
    source: snap.budgetSource,
    active,
    activeShare: snap.econ.population > 0 ? active / snap.econ.population : 0,
    reserves,
    capitalBn: capital / 1e9,
    readiness: snap.view.readiness,
    cLevel: snap.view.cLevel,
    combatPower: snap.view.combatPower,
    branches: snap.view.branches
      .map((b) => `${b.domain} ${Math.round(b.active).toLocaleString("en-US")}/${(b.capital / 1e9).toFixed(1)}bn ${b.cLevel}`)
      .join("; "),
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export function report(rows: Row[], show: string[]) {
  console.log(`\nNations reset: ${rows.length}`);
  if (rows.length === 0) return;
  const shares = rows.filter((r) => r.population > 0).map((r) => r.activeShare).sort((a, b) => a - b);
  const q = (p: number) => shares[Math.min(shares.length - 1, Math.floor(p * shares.length))] ?? 0;
  const outside = rows.filter((r) => r.population > 0 && (r.activeShare < BAND.min || r.activeShare > BAND.max));
  console.log(
    `Active share of population: min ${pct(q(0))}, p10 ${pct(q(0.1))}, median ${pct(q(0.5))}, p90 ${pct(q(0.9))}, max ${pct(q(1))}`
  );
  console.log(`Outside the 0.2–1.1% sanity band: ${outside.length}`);
  for (const r of outside.slice(0, 15)) {
    console.log(`  ${r.name}: ${pct(r.activeShare)} (pop ${fmt(r.population)}, GDPpc ${fmt(r.gdpPerCapita)}, ${r.source})`);
  }
  const bySource = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.source]: (m[r.source] ?? 0) + 1 }), {});
  console.log(`Budget sources: ${JSON.stringify(bySource)}`);
  const cLevels = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.cLevel]: (m[r.cLevel] ?? 0) + 1 }), {});
  console.log(`C-levels: ${JSON.stringify(cLevels)}`);
  const picked = rows.filter((r) => show.some((name) => r.name.toLowerCase() === name.toLowerCase()));
  for (const r of picked) {
    console.log(
      `\n${r.name}: pop ${fmt(r.population)}, GDPpc ${fmt(r.gdpPerCapita)}, defense ${fmt(r.budget)} (${pct(r.burden)} of GDP, ${r.source})` +
        `\n  active ${fmt(r.active)} (${pct(r.activeShare)}), reserves ${fmt(r.reserves)}, capital ${r.capitalBn.toFixed(1)}bn,` +
        ` readiness ${r.readiness.toFixed(3)} ${r.cLevel}, combat power ${fmt(r.combatPower)}\n  ${r.branches}`
    );
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const only = flag("--country");
  const show = (flag("--show") ?? "Caphiria,E2E Testland,Fiannria").split(",").map((s) => s.trim());
  const db = new PrismaClient();
  const [{ current_database: database }] =
    await db.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  const refusal = resetRefusal(database, process.argv);
  if (refusal) {
    await db.$disconnect();
    throw new Error(refusal);
  }
  console.log(`${apply ? "APPLY" : "DRY RUN (rolled back)"} on ${database}`);

  const ids = async (tx: Prisma.TransactionClient) =>
    only ? [only] : (await tx.country.findMany({ select: { id: true }, orderBy: { name: "asc" } })).map((c) => c.id);
  const rows: Row[] = [];
  try {
    if (apply) {
      for (const id of await ids(db)) {
        const row = await resetCountry(db, id);
        if (row) rows.push(row);
      }
    } else {
      await db.$transaction(
        async (tx) => {
          for (const file of DRY_RUN_SQL) {
            for (const statement of sqlStatements(readFileSync(join(SQL_DIR, file), "utf8"))) {
              await tx.$executeRawUnsafe(statement);
            }
          }
          for (const id of await ids(tx)) {
            const row = await resetCountry(tx, id);
            if (row) rows.push(row);
          }
          throw new RolledBack();
        },
        { timeout: 30 * 60 * 1000, maxWait: 60_000 }
      );
    }
  } catch (error) {
    if (!(error instanceof RolledBack)) throw error;
  } finally {
    await db.$disconnect();
  }
  report(rows, show);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
