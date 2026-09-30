/**
 * One-off data fix: re-date StorytellerEffect rows (table `"DmInputs"`) written with the
 * ms×1000 bug fixed by plan 329.
 *
 * Why: before plan 329, every effect written by the scheduled-changes router and by
 * applyGovernmentComponentEffects multiplied IxTime.getCurrentIxTime() — which already
 * returns milliseconds — by 1000 before wrapping it in `new Date(...)`, so those rows are
 * dated ~72,000 years in the future and the economy engine (getActiveEffects) never
 * applies them. The fix is `timestamp / 1000`.
 *
 * Usage — OPERATOR ONLY. Never run by an agent; never against production without 1–3:
 *   1. Size first (read-only SQL):
 *        SELECT split_part(description, ' ', 1) AS prefix, "isActive", count(*)
 *        FROM "DmInputs" WHERE "ixTimeTimestamp" > '3000-01-01'
 *        GROUP BY 1, 2 ORDER BY 3 DESC;
 *   2. bun run scripts/fix-storyteller-effect-timestamps.ts            # dry run — review
 *   3. Announce to players before --apply: once re-dated, ACTIVE [GovComponent] and
 *      [BrokerComponent] bonuses/penalties (±0.1 growth modifiers, 5-year duration) start
 *      affecting country economies for the first time, so GDP/population trajectories
 *      will visibly shift.
 *   4. bun run scripts/fix-storyteller-effect-timestamps.ts --apply
 *
 * Rules:
 *   - Only rows with ixTimeTimestamp > 3000-01-01 are candidates.
 *   - fixed = round(ts / 1000). Its UTC year must be within [2020, 2200]; otherwise the
 *     row is listed under "unexpected" and left untouched (STOP and investigate).
 *   - Rows whose description starts with "Scheduled change:" are re-dated AND set
 *     isActive = false: their `value` is an absolute target from the old router code and
 *     must not start applying.
 *   - Every other row ([GovComponent], [BrokerComponent], anything else) is re-dated only.
 *
 * Idempotent: after --apply no candidate remains (> 3000-01-01), so a re-run finds 0 rows.
 * Bun loads .env / .env.local automatically, so DATABASE_URL needs no extra wiring.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const FUTURE_CUTOFF = new Date("3000-01-01T00:00:00.000Z");
const MIN_YEAR = 2020;
const MAX_YEAR = 2200;
const BATCH_SIZE = 100;
const SCHEDULED_PREFIX = "Scheduled change:";

interface Candidate {
  id: string;
  description: string | null;
  isActive: boolean;
  ixTimeTimestamp: Date;
  value: number;
  inputType: string;
}

interface PlannedFix {
  id: string;
  prefix: string;
  wasActive: boolean;
  from: Date;
  to: Date;
  deactivate: boolean;
}

/** First token of the description up to and including `]` or `:` (e.g. "[GovComponent]"). */
function prefixOf(description: string | null): string {
  if (!description) return "(none)";
  const match = /^[^\]:]*[\]:]/.exec(description);
  return match ? match[0] : (description.split(" ")[0] ?? description);
}

function planFix(row: Candidate): { fix: PlannedFix | null; unexpected: Candidate | null } {
  const to = new Date(Math.round(row.ixTimeTimestamp.getTime() / 1000));
  const year = to.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return { fix: null, unexpected: row };
  return {
    fix: {
      id: row.id,
      prefix: prefixOf(row.description),
      wasActive: row.isActive,
      from: row.ixTimeTimestamp,
      to,
      deactivate: (row.description ?? "").startsWith(SCHEDULED_PREFIX),
    },
    unexpected: null,
  };
}

function printSummary(candidates: Candidate[], fixes: PlannedFix[], unexpected: Candidate[]): void {
  const counts = new Map<string, number>();
  for (const row of candidates) {
    const key = `${prefixOf(row.description)} | isActive=${row.isActive}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log("\nCandidates by description prefix × isActive:");
  for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${key}`);
  }

  const scheduled = fixes.filter((f) => f.deactivate);
  if (scheduled.length > 0) {
    console.log(`\n"${SCHEDULED_PREFIX}" rows to re-date AND deactivate (${scheduled.length}):`);
    for (const f of scheduled) {
      console.log(
        `  ${f.id}  ${f.from.toISOString()} -> ${f.to.toISOString()}  wasActive=${f.wasActive}`
      );
    }
  }

  if (unexpected.length > 0) {
    console.log(`\nUNEXPECTED rows (fixed year outside ${MIN_YEAR}-${MAX_YEAR}) — left untouched:`);
    for (const row of unexpected) {
      console.log(
        `  ${row.id}  ${row.ixTimeTimestamp.toISOString()}  ${row.inputType}  value=${row.value}  ${row.description ?? ""}`
      );
    }
  }

  console.log(
    `\nWould change: ${fixes.length} row(s) (${scheduled.length} also deactivated); unexpected: ${unexpected.length}.`
  );
}

async function main(): Promise<void> {
  const candidates = await prisma.storytellerEffect.findMany({
    where: { ixTimeTimestamp: { gt: FUTURE_CUTOFF } },
    select: {
      id: true,
      description: true,
      isActive: true,
      ixTimeTimestamp: true,
      value: true,
      inputType: true,
    },
    orderBy: { ixTimeTimestamp: "asc" },
  });

  console.log(
    `Mode: ${APPLY ? "APPLY" : "DRY RUN"}. Candidates with ixTimeTimestamp > ${FUTURE_CUTOFF.toISOString()}: ${candidates.length}`
  );

  const fixes: PlannedFix[] = [];
  const unexpected: Candidate[] = [];
  for (const row of candidates) {
    const planned = planFix(row);
    if (planned.fix) fixes.push(planned.fix);
    if (planned.unexpected) unexpected.push(planned.unexpected);
  }

  printSummary(candidates, fixes, unexpected);

  if (!APPLY) {
    console.log("\nDRY RUN — no changes written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (let i = 0; i < fixes.length; i += BATCH_SIZE) {
    const chunk = fixes.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      chunk.map((f) =>
        prisma.storytellerEffect.update({
          where: { id: f.id },
          data: f.deactivate ? { ixTimeTimestamp: f.to, isActive: false } : { ixTimeTimestamp: f.to },
        })
      )
    );
    written += chunk.length;
    console.log(`  wrote ${written}/${fixes.length}`);
  }

  console.log(
    `\nDone. ${written} row(s) re-dated; ${unexpected.length} unexpected row(s) left untouched.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
