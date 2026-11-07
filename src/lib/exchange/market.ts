/**
 * The Exchange market tick (cron job `exchange-market`, src/server/cron/jobs.ts; off unless
 * named in CRON_ENABLED_JOBS). Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * In order: each nation's treasury stipend, the sector indices, every realm's company operations,
 * the decisions that have waited their day, the proposals whose vote window has closed, the
 * lapsed contracts, the corporate feedback into each nation's GDP, and each active company's
 * fair value.
 *
 * Every step is safe to re-run: a stipend is keyed per nation per tick, a realm's operations per
 * realm per tick, decisions apply once, and the other steps act only on rows still open.
 */

import type { PrismaClient } from "@prisma/client";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { round2 } from "./amounts";
import { refreshFairValue } from "./companies";
import { resolveDueDecisions } from "./decisions";
import { expireLapsedContracts } from "./expiry";
import { syncCorporateFeedback } from "./feedback";
import { finalizeProposalsTx } from "./governance";
import { notifyExchange } from "./notify";
import { operatingTickKey, runCompanyOperations, TICKS_PER_DAY } from "./operations";
import { computeSectorIndices } from "./sectors";
import { mintStipendTx, stipendFor } from "./treasury";
import { runBondPayments } from "./bonds";
import { alertWatchers } from "./news";
import { runPolicyHeadlines } from "./policy";

/** Nations that host an operating company or already hold a treasury. */
async function stipendNationsOf(db: PrismaClient) {
  const [hosts, treasuries] = await Promise.all([
    db.company.findMany({
      where: { hqCountryId: { not: null }, status: { in: ["ACTIVE", "DISTRESSED"] } },
      select: { hqCountryId: true },
    }),
    db.nationTreasury.findMany({ select: { countryId: true } }),
  ]);
  const ids = [
    ...new Set([
      ...hosts.flatMap((h) => (h.hqCountryId ? [h.hqCountryId] : [])),
      ...treasuries.map((t) => t.countryId),
    ]),
  ];
  if (ids.length === 0) return [];
  return db.country.findMany({
    where: { id: { in: ids } },
    select: { id: true, realmId: true, economicTier: true },
  });
}

async function mintStipendsOf(db: PrismaClient, nowMs: number, tickKey: string): Promise<number> {
  const cfg = await getExchangeConfig(db);
  let minted = 0;
  for (const nation of await stipendNationsOf(db)) {
    const amount = stipendFor(nation.economicTier, cfg.treasuryDailyStipend / TICKS_PER_DAY);
    try {
      minted += await db.$transaction((tx) =>
        mintStipendTx(tx, {
          countryId: nation.id,
          realmId: nation.realmId,
          ixTime: nowMs,
          cap: cfg.treasuryCap,
          amount,
          key: `exchange-stipend:${nation.id}:${tickKey}`,
        })
      );
    } catch (error) {
      console.error(`[Exchange] stipend for ${nation.id} failed:`, error);
    }
  }
  return round2(minted);
}

async function finalizeProposalsOf(db: PrismaClient, nowMs: number): Promise<number> {
  const due = await db.companyProposal.findMany({
    where: { status: "OPEN", expiresIxTime: { lte: nowMs } },
    select: { companyId: true },
  });
  let expired = 0;
  for (const companyId of new Set(due.map((p) => p.companyId))) {
    try {
      const result = await db.$transaction((tx) => finalizeProposalsTx(tx, companyId, nowMs));
      notifyExchange(result.notices);
      expired += result.expired;
    } catch (error) {
      console.error(`[Exchange] settling proposals of ${companyId} failed:`, error);
    }
  }
  return expired;
}

async function refreshActiveFairValues(db: PrismaClient): Promise<number> {
  const companies = await db.company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  let refreshed = 0;
  for (const { id } of companies) {
    try {
      await refreshFairValue(db, id);
      refreshed++;
    } catch (error) {
      console.error(`[Exchange] refreshing fair value of ${id} failed:`, error);
    }
  }
  return refreshed;
}

export async function runExchangeMarketTick(db: PrismaClient) {
  const nowMs = Date.now();
  const tickKey = operatingTickKey(nowMs);
  const stipendsMinted = await mintStipendsOf(db, nowMs, tickKey);
  const bonds = await runBondPayments(db, nowMs);
  const indices = await computeSectorIndices(db, nowMs);
  const operations = await runCompanyOperations(db, nowMs);
  const decisionsApplied = await resolveDueDecisions(db, nowMs);
  const proposalsExpired = await finalizeProposalsOf(db, nowMs);
  const contracts = await expireLapsedContracts(db, nowMs);
  const feedback = await syncCorporateFeedback(db, nowMs);
  const companiesRefreshed = await refreshActiveFairValues(db);
  const policy = await runPolicyHeadlines(db, nowMs);
  await alertWatchers(db, [...bonds.news, ...policy]);
  return {
    stipendsMinted,
    bonds: { couponsPaid: bonds.couponsPaid, matured: bonds.matured, defaulted: bonds.defaulted },
    policyHeadlines: policy.length,
    indices: indices.map((i) => ({ sector: i.sectorKey, value: i.value })),
    operations,
    decisionsApplied,
    proposalsExpired,
    contracts,
    feedback,
    companiesRefreshed,
  };
}
