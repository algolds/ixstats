/**
 * One-off MC-1 migration: remap BudgetAllocation.budgetYear from real-calendar years to the
 * IxTime basis (`currentBudgetYear()`). Dry run by default; pass --apply to write.
 *   bun run db:remap-budget-years [--dry-run | --apply]
 * The IxTime year is taken after a best-effort sync with the IxTime bot, so a bot time override
 * is honoured the way the app honours it. Take a backup first (`bun run db:backup`). Rows whose
 * target year the department already holds are reported and left alone. Re-running after --apply
 * is a no-op (no legacy rows remain).
 */
import { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { planBudgetYearRemap, summarizeRemap } from "./budget-year-remap-plan";

const db = new PrismaClient();
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");

async function main() {
  console.log(apply ? "APPLY mode — writing" : "DRY RUN — pass --apply to write");
  const sync = await IxTime.syncWithBot();
  console.log(`IxTime: ${sync.message}`);
  const realYear = new Date().getUTCFullYear();
  const ixYear = currentBudgetYear();
  const rows = await db.budgetAllocation.findMany({
    select: { id: true, departmentId: true, budgetYear: true },
  });
  const plan = planBudgetYearRemap(rows, realYear, ixYear);

  console.log(`real year ${realYear}, IxTime budget year ${ixYear}: offset +${plan.offset}`);
  console.log(
    `${rows.length} allocations: ${plan.updates.length} to remap, ${plan.conflicts.length} conflicts, ${plan.unchanged} already on the IxTime basis`
  );
  for (const line of summarizeRemap(plan)) console.log(`  ${line}`);
  for (const c of plan.conflicts) {
    console.log(
      `  CONFLICT ${c.id} (department ${c.departmentId}): ${c.from} → ${c.to} is already held by ${c.existingId} — left as-is; resolve by hand`
    );
  }
  if (!apply || plan.updates.length === 0) return;

  await db.$transaction(
    plan.updates.map((u) =>
      db.budgetAllocation.update({ where: { id: u.id }, data: { budgetYear: u.to } })
    )
  );
  console.log(`Remapped ${plan.updates.length} allocations.`);
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
