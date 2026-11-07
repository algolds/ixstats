/**
 * Policy headlines (docs/specs/2026-11-06-exchange-overhaul-design.md §9). The market tick reads each Exchange
 * nation's business figures (corporate and capital-gains tax, interest rate, sector tariffs, free-trade partners),
 * compares them with the snapshot it stored last time and publishes one headline per change. The Exchange only reads
 * MyCountry; it never hooks its writes. A nation's first snapshot publishes nothing.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { SectorKey } from "./companies";
import type { Db } from "./guards";
import { publishNewsTx, type PublishedHeadline } from "./news";
import { macroOfCountry } from "./tariffs";

const SECTORS: readonly SectorKey[] = ["agriculture", "industry", "services", "government"];
/** Changes smaller than 0.05 percentage points are rounding, not policy. */
const MIN_CHANGE = 0.0005;

export interface PolicySnapshot {
  corporateTaxRate: number;
  capGainsTaxRate: number;
  interestRate: number;
  tariffs: Record<SectorKey, number>;
  ftaPartnerIds: string[];
}

type RateField = "corporateTaxRate" | "capGainsTaxRate" | "interestRate";

export type PolicyChange =
  | { field: RateField; from: number; to: number }
  | { field: "tariff"; sectorKey: SectorKey; from: number; to: number }
  | { field: "fta"; partnerId: string; change: "signed" | "ended" };

const RATE_FIELDS: readonly RateField[] = ["corporateTaxRate", "capGainsTaxRate", "interestRate"];
const moved = (from: number, to: number) => Math.abs(to - from) >= MIN_CHANGE;

/** What changed between two snapshots; nothing when there is no earlier one. */
export function policyChanges(prev: PolicySnapshot | null, next: PolicySnapshot): PolicyChange[] {
  if (!prev) return [];
  const rates = RATE_FIELDS.filter((f) => moved(prev[f], next[f])).map((field): PolicyChange => ({
    field,
    from: prev[field],
    to: next[field],
  }));
  const tariffs = SECTORS.filter((s) => moved(prev.tariffs[s] ?? 0, next.tariffs[s] ?? 0)).map(
    (sectorKey): PolicyChange => ({
      field: "tariff",
      sectorKey,
      from: prev.tariffs[sectorKey] ?? 0,
      to: next.tariffs[sectorKey] ?? 0,
    })
  );
  const signed = next.ftaPartnerIds
    .filter((id) => !prev.ftaPartnerIds.includes(id))
    .map((partnerId): PolicyChange => ({ field: "fta", partnerId, change: "signed" }));
  const ended = prev.ftaPartnerIds
    .filter((id) => !next.ftaPartnerIds.includes(id))
    .map((partnerId): PolicyChange => ({ field: "fta", partnerId, change: "ended" }));
  return [...rates, ...tariffs, ...signed, ...ended];
}

const pct = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

const RATE_WORDS: Record<RateField, string> = {
  corporateTaxRate: "corporate tax",
  capGainsTaxRate: "capital gains tax",
  interestRate: "its interest rate",
};

/** The headline for one change. */
export function policyHeadline(nation: string, c: PolicyChange, partnerName = "a partner"): string {
  if (c.field === "fta") {
    return c.change === "signed"
      ? `${nation} and ${partnerName} sign a free-trade agreement`
      : `${nation} and ${partnerName} end their free-trade agreement`;
  }
  if (c.field === "tariff") return `${nation} sets its ${c.sectorKey} tariff at ${pct(c.to)}`;
  return `${nation} ${c.to > c.from ? "raises" : "cuts"} ${RATE_WORDS[c.field]} to ${pct(c.to)}`;
}

/** Nations the Exchange follows: hosts of a live company, holders of a treasury, issuers of an open bond. */
async function followedNations(db: PrismaClient): Promise<string[]> {
  const [hosts, treasuries, bonds] = await Promise.all([
    db.company.findMany({
      where: { hqCountryId: { not: null }, status: { in: ["ACTIVE", "DISTRESSED"] } },
      select: { hqCountryId: true },
    }),
    db.nationTreasury.findMany({ select: { countryId: true } }),
    db.nationBond.findMany({ where: { status: "OPEN" }, select: { countryId: true } }),
  ]);
  return [
    ...new Set([
      ...hosts.flatMap((h) => (h.hqCountryId ? [h.hqCountryId] : [])),
      ...treasuries.map((t) => t.countryId),
      ...bonds.map((b) => b.countryId),
    ]),
  ];
}

async function ftaPartnersOf(db: Db, countryId: string): Promise<string[]> {
  const rows = await db.foreignPolicyAction.findMany({
    where: {
      actionType: "free_trade",
      status: "active",
      OR: [{ initiatorId: countryId }, { targetId: countryId }],
    },
    select: { initiatorId: true, targetId: true },
  });
  const ids = rows.map((r) => (r.initiatorId === countryId ? r.targetId : r.initiatorId));
  return [...new Set(ids.filter((id): id is string => !!id))].sort();
}

async function snapshotOf(db: Db, countryId: string): Promise<PolicySnapshot | null> {
  const macro = await macroOfCountry(db, countryId);
  if (!macro) return null;
  return {
    corporateTaxRate: macro.corporateTaxRate,
    capGainsTaxRate: macro.capGainsTaxRate,
    interestRate: macro.interestRate,
    tariffs: Object.fromEntries(SECTORS.map((s) => [s, macro.tariffFor(s)])) as Record<
      SectorKey,
      number
    >,
    ftaPartnerIds: await ftaPartnersOf(db, countryId),
  };
}

function storedSnapshot(row: {
  corporateTaxRate: number;
  capGainsTaxRate: number;
  interestRate: number;
  tariffs: Prisma.JsonValue;
  ftaPartnerIds: Prisma.JsonValue;
}): PolicySnapshot {
  const raw =
    row.tariffs && typeof row.tariffs === "object" && !Array.isArray(row.tariffs)
      ? row.tariffs
      : {};
  const tariffs = Object.fromEntries(
    SECTORS.map((s) => [s, typeof raw[s] === "number" ? raw[s] : 0])
  ) as Record<SectorKey, number>;
  const partners = Array.isArray(row.ftaPartnerIds)
    ? row.ftaPartnerIds.filter((p): p is string => typeof p === "string")
    : [];
  return {
    corporateTaxRate: row.corporateTaxRate,
    capGainsTaxRate: row.capGainsTaxRate,
    interestRate: row.interestRate,
    tariffs,
    ftaPartnerIds: partners,
  };
}

const subjectOf = (c: PolicyChange) =>
  c.field === "fta" ? c.partnerId : c.field === "tariff" ? c.sectorKey : "";

async function publishChangesTx(
  tx: Db,
  nation: { id: string; name: string; realmId: string },
  changes: readonly PolicyChange[],
  nowMs: number
): Promise<PublishedHeadline[]> {
  const out: PublishedHeadline[] = [];
  for (const c of changes) {
    const partner =
      c.field === "fta"
        ? await tx.country.findUnique({ where: { id: c.partnerId }, select: { name: true } })
        : null;
    const headline = await publishNewsTx(tx, {
      realmId: nation.realmId,
      kind: "policy",
      prominence: "HEADLINE",
      sourceKind: "NATION",
      sourceId: nation.id,
      headline: policyHeadline(nation.name, c, partner?.name),
      countryId: nation.id,
      key: `news:policy:${nation.id}:${c.field}:${subjectOf(c)}:${nowMs}`,
    });
    if (headline) out.push(headline);
  }
  return out;
}

/** Diff every followed nation against its last snapshot, publish the changes, store the new snapshot. */
export async function runPolicyHeadlines(
  db: PrismaClient,
  nowMs: number
): Promise<PublishedHeadline[]> {
  const published: PublishedHeadline[] = [];
  for (const countryId of await followedNations(db)) {
    try {
      const nation = await db.country.findUnique({
        where: { id: countryId },
        select: { id: true, name: true, realmId: true },
      });
      const next = nation ? await snapshotOf(db, countryId) : null;
      if (!nation || !next) continue;
      const items = await db.$transaction(async (tx) => {
        const row = await tx.exchangeNationSnapshot.findUnique({ where: { countryId } });
        const changes = policyChanges(row ? storedSnapshot(row) : null, next);
        await tx.exchangeNationSnapshot.upsert({
          where: { countryId },
          create: { countryId, ...next },
          update: next,
        });
        return publishChangesTx(tx, nation, changes, nowMs);
      });
      published.push(...items);
    } catch (error) {
      console.error(`[Exchange] policy headlines for ${countryId} failed:`, error);
    }
  }
  return published;
}
