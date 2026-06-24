/**
 * One-off backfill: seed `GovernmentBranch` rows from the legacy
 * executiveName/legislativeName/judicialName fields on GovernmentStructure.
 *
 * Why: T6 of the lore-alignment plan added an N-branch child table so governments
 * can have four+ bespoke branches (Faneria "Quaternalist", Caphiria "triumirs").
 * Existing structures only have the three legacy name fields — turn each non-empty
 * one into a branch row so the new UI/readers have data on day one. The legacy fields
 * are kept; this is purely additive. See plans/mycountry-lore-alignment*.md.
 *
 * Usage:
 *   bun run scripts/backfill-government-branches.ts          # dry run — prints planned rows
 *   bun run scripts/backfill-government-branches.ts --apply  # actually write
 *
 * Idempotent: a structure that already has any GovernmentBranch rows is skipped.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const LEGACY: Array<{ field: "executiveName" | "legislatureName" | "judicialName"; type: string; fallback: string }> = [
  { field: "executiveName", type: "executive", fallback: "Executive" },
  { field: "legislatureName", type: "legislative", fallback: "Legislature" },
  { field: "judicialName", type: "judicial", fallback: "Judiciary" },
];

async function main() {
  const structures = await prisma.governmentStructure.findMany({
    select: {
      id: true,
      countryId: true,
      executiveName: true,
      legislatureName: true,
      judicialName: true,
      _count: { select: { branches: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const s of structures) {
    if (s._count.branches > 0) {
      skipped++;
      continue;
    }
    // Build a branch row for each legacy field that has a value. If a structure has
    // none set, seed the three standard branches with default names so it isn't empty.
    const anyNamed = LEGACY.some((l) => (s as any)[l.field]);
    const rows = LEGACY.map((l, order) => ({
      governmentStructureId: s.id,
      name: ((s as any)[l.field] as string | null)?.trim() || l.fallback,
      branchType: l.type,
      order,
    })).filter((_, i) => anyNamed ? !!((s as any)[LEGACY[i]!.field]) : true);

    if (rows.length === 0) continue;

    console.log(`structure ${s.id} (country ${s.countryId}): +${rows.length} branches → ${rows.map((r) => r.name).join(", ")}`);
    if (APPLY) {
      await prisma.governmentBranch.createMany({ data: rows });
    }
    created += rows.length;
  }

  console.log(
    `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${structures.length} structures, ${skipped} already had branches, ${created} branch rows ${APPLY ? "created" : "planned"}.`,
  );
  if (!APPLY) console.log("Re-run with --apply to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
