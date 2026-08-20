/**
 * One-off: reset transient MyCountry gameplay state and remove demo data to
 * prep a clean live preview. Does NOT touch core country/user/economy/gov data
 * or reference templates — only resettable, engine-regenerated state.
 *
 * Usage:
 *   bun run scripts/reset-for-live-preview.ts            # DRY RUN — counts only
 *   bun run scripts/reset-for-live-preview.ts --apply    # actually delete
 *
 * Cleared (all countries): national issues (+consequences), issue logs, policies
 * (+effect logs), cabinet meetings (+agenda/attendance/decisions/action items),
 * activity schedules, intelligence briefings/alerts/recommendations, vitality
 * snapshots, country activity, social activity feed, country-tied notifications.
 * Removed: any `isDemo: true` country (via the canonical DemoSeedService).
 *
 * NOT touched: Country, User, Demographics/EconomicProfile/GovernmentStructure/
 * TaxSystem/LaborMarket/etc., and all *Template / reference tables.
 */
import { PrismaClient } from "@prisma/client";
import { DemoSeedService } from "../src/lib/demo-seed/demo-seed-service";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Transient gameplay-state models to clear across ALL countries. Children with
// onDelete: Cascade (consequences, effect logs, meeting children, alerts/recs)
// are removed automatically when their parent row is deleted.
const TARGETS: { label: string; model: any }[] = [
  { label: "nationalIssue", model: prisma.nationalIssue },
  { label: "issueGenerationLog", model: prisma.issueGenerationLog },
  { label: "policy", model: prisma.policy },
  { label: "cabinetMeeting", model: prisma.cabinetMeeting },
  { label: "activitySchedule", model: prisma.activitySchedule },
  { label: "intelligenceBriefing", model: prisma.intelligenceBriefing },
  { label: "intelligenceAlert", model: prisma.intelligenceAlert },
  { label: "intelligenceRecommendation", model: prisma.intelligenceRecommendation },
  { label: "vitalitySnapshot", model: prisma.vitalitySnapshot },
  { label: "countryActivity", model: prisma.countryActivity },
  { label: "activityFeed", model: prisma.activityFeed },
];

async function main() {
  console.log(`Reset for live preview — mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  // 1. Transient gameplay state
  for (const t of TARGETS) {
    if (!t.model || typeof t.model.count !== "function") {
      console.log(`?  ${t.label}: model not found on client — skipping`);
      continue;
    }
    const n = await t.model.count();
    console.log(`${APPLY ? "deleting" : "would delete"} ${n.toString().padStart(6)}  ${t.label}`);
    if (APPLY && n > 0) await t.model.deleteMany({});
  }

  // Country-tied notifications only (keep purely user/system notices).
  const notifN = await prisma.notification.count({ where: { countryId: { not: null } } });
  console.log(
    `${APPLY ? "deleting" : "would delete"} ${notifN.toString().padStart(6)}  notification (countryId set)`
  );
  if (APPLY && notifN > 0) {
    await prisma.notification.deleteMany({ where: { countryId: { not: null } } });
  }

  // 2. Demo countries (isDemo: true) — canonical destroy path.
  const demoCountries = await prisma.country.findMany({
    where: { isDemo: true },
    select: { id: true, name: true },
  });
  console.log(`\nDemo countries found: ${demoCountries.length}`);
  for (const c of demoCountries) {
    console.log(`  ${APPLY ? "destroying" : "would destroy"} demo country: ${c.name} (${c.id})`);
    if (APPLY) await DemoSeedService.destroyDemoCountry(prisma, c.id);
  }
  if (APPLY && demoCountries.length > 0) {
    await prisma.systemConfig.deleteMany({
      where: { key: { in: ["demo_mode_active", "demo_country_id", "demo_source_country_id"] } },
    });
    console.log("  cleared demo SystemConfig keys");
  }

  // Safety check: confirm real nations are untouched.
  const realCount = await prisma.country.count({ where: { isDemo: false } });
  console.log(`\nReal nations (isDemo:false) intact: ${realCount}`);

  console.log(APPLY ? "\nDone." : "\nDry run complete — re-run with --apply to execute.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
