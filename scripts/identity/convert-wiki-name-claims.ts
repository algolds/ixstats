/**
 * The IxnayID conversion (design decision 8): IxWiki links and legacy `wikiUsername` values become name claims. A
 * verified link becomes an APPROVED claim that keeps who verified it, an unverified link or a legacy name a PENDING one,
 * and a player who turned wiki attribution off keeps every claim hidden (`visible = false`). The deploy runs it with
 * --apply on every release (after the claims SQL, before the push): a re-run writes nothing, and a revoked or rejected
 * claim never comes back. It tags no revisions and runs no claim hooks (the tag backfill and plan B's syncs do).
 *   bun scripts/identity/convert-wiki-name-claims.ts           # dry run: prints the plan, writes nothing
 *   bun scripts/identity/convert-wiki-name-claims.ts --apply   # creates the claims and the conversion marker
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { lockWikiNameTx } from "~/lib/identity/claim-tags";
import {
  CONVERSION_MARKER,
  planConversion,
  type ConversionPlan,
  type ConvertedClaim,
  type SkipReason,
} from "~/lib/identity/legacy-identity";
import { IXWIKI } from "~/lib/identity/wiki-names";
import { loadLegacySnapshot } from "./legacy-snapshot";

const BATCH = 500;
const TX_OPTIONS = { timeout: 120_000 } as const;
const SHOWN_CREATIONS = 20;

export function parseConvertArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes("--apply") };
}

function conversionCounts(plan: ConversionPlan) {
  const byNote: Record<string, number> = {};
  for (const c of plan.create) byNote[c.decisionNote] = (byNote[c.decisionNote] ?? 0) + 1;
  const skipped: Record<SkipReason, number> = { EXISTS: 0, NAME_TAKEN: 0, INVALID: 0 };
  for (const s of plan.skipped) skipped[s.reason] += 1;
  return {
    approved: plan.create.filter((c) => c.status === "APPROVED").length,
    pending: plan.create.filter((c) => c.status === "PENDING").length,
    hidden: plan.create.filter((c) => !c.visible).length,
    byNote,
    skipped,
    conflicts: plan.conflicts.length,
  };
}

/**
 * One batch in one transaction: each name's lock (41103, sorted, so two writers never wait on each other in a cycle),
 * then what the claims table holds now, so a claim written since the plan was made (or by an earlier run) is left alone.
 */
async function createBatchTx(
  tx: Prisma.TransactionClient,
  batch: ConvertedClaim[]
): Promise<number> {
  const names = [...new Set(batch.map((c) => c.name))].sort();
  for (const name of names) await lockWikiNameTx(tx, IXWIKI, name);
  const live = await tx.wikiNameClaim.findMany({
    where: { source: IXWIKI, name: { in: names } },
    select: { userId: true, name: true, status: true },
  });
  const claimed = new Set(live.map((c) => `${c.userId}\u0000${c.name}`));
  const held = new Set(live.filter((c) => c.status === "APPROVED").map((c) => c.name));
  const fresh = batch.filter(
    (c) =>
      !claimed.has(`${c.userId}\u0000${c.name}`) && !(c.status === "APPROVED" && held.has(c.name))
  );
  const { count } = await tx.wikiNameClaim.createMany({
    data: fresh.map((c) => ({
      ...c,
      source: IXWIKI,
      origin: "CONVERSION" as const,
      requestedById: c.userId,
    })),
    skipDuplicates: true,
  });
  return count;
}

export async function applyConversion(
  db: PrismaClient,
  plan: ConversionPlan
): Promise<{ created: number }> {
  let created = 0;
  for (let i = 0; i < plan.create.length; i += BATCH) {
    const batch = plan.create.slice(i, i + BATCH);
    created += await db.$transaction((tx) => createBatchTx(tx, batch), TX_OPTIONS);
  }
  const marker = await db.adminAuditLog.findFirst({
    where: { action: CONVERSION_MARKER },
    select: { id: true },
  });
  if (!marker) {
    await db.adminAuditLog.create({
      data: {
        action: CONVERSION_MARKER,
        targetType: "system",
        targetId: "wiki_name_claims",
        targetName: "IxWiki links",
        changes: JSON.stringify({ created, ...conversionCounts(plan) }),
        adminId: "system",
        adminName: "convert-wiki-name-claims",
      },
    });
  }
  return { created };
}

function printPlan(plan: ConversionPlan): void {
  const shown = plan.create.slice(0, SHOWN_CREATIONS).map((c) => ({
    userId: c.userId,
    name: c.name,
    status: c.status,
    visible: c.visible,
    rightsPass: c.rightsPass,
    decidedById: c.decidedById,
    note: c.decisionNote,
  }));
  const report = {
    counts: conversionCounts(plan),
    conflicts: plan.conflicts,
    skipped: plan.skipped,
    firstCreations: shown,
  };
  console.log(JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  const { apply } = parseConvertArgs(process.argv.slice(2));
  const db = new PrismaClient();
  try {
    const plan = planConversion(await loadLegacySnapshot(db));
    printPlan(plan);
    if (!apply) {
      console.log("[convert-wiki-name-claims] dry run: nothing written (pass --apply to write)");
      return;
    }
    const { created } = await applyConversion(db, plan);
    console.log(`[convert-wiki-name-claims] created ${created} claims`);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(`[convert-wiki-name-claims] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
