/**
 * Read-only report of closed (BANKRUPT / DELISTED) Exchange companies that still hold capital,
 * OPEN/AWARDED/DISPUTED contracts they issued, pending decisions, or open ACQUIRE_OFFER proposals
 * they made as a buyer. Never writes to the database.
 *
 * Usage:
 *   bun scripts/exchange/report-stranded-escrow.ts [--help]
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { acquirePayloadOf } from "~/lib/exchange/acquisition";
import { centsOf, formatSovereigns, fromCents, toCents } from "~/lib/exchange/amounts";
import type { DecisionPayload } from "~/lib/exchange/decisions";
import { createPrismaClient } from "~/server/prisma-client";

type Db = Pick<
  PrismaClient,
  "company" | "contract" | "companyDecision" | "companyProposal"
>;

export interface ClosedCompanyRow {
  id: string;
  name: string;
  status: string;
  realmId: string;
  hqCountryId: string | null;
  capital: bigint | number;
}

export interface IssuedContractRow {
  id: string;
  title: string;
  status: string;
  issuerCompanyId: string | null;
  escrow: bigint | number;
}

export interface PendingDecisionRow {
  id: string;
  companyId: string;
  type: string;
  payload: Prisma.JsonValue;
}

export interface OpenOfferProposalRow {
  id: string;
  companyId: string;
  payload: Prisma.JsonValue;
}

export interface StrandedCompanyEntry {
  companyId: string;
  name: string;
  status: string;
  realmId: string;
  hqCountryId: string | null;
  capitalSovereigns: number;
  contracts: Array<{ id: string; title: string; status: string; escrowSovereigns: number }>;
  pendingDecisions: Array<{ id: string; type: string; costSovereigns: number }>;
  openOffers: Array<{ proposalId: string; targetCompanyId: string; offerSovereigns: number }>;
  totalStrandedSovereigns: number;
}

function decisionCostCents(payload: Prisma.JsonValue): number {
  const record = (payload ?? {}) as Partial<DecisionPayload>;
  return Math.max(0, toCents(Number(record.cost ?? 0)));
}

/** Select closed companies that still hold capital, live issued contracts, pending decisions, or open offers. */
export function selectStrandedCompanies(input: {
  companies: readonly ClosedCompanyRow[];
  contracts: readonly IssuedContractRow[];
  decisions: readonly PendingDecisionRow[];
  proposals: readonly OpenOfferProposalRow[];
}): StrandedCompanyEntry[] {
  const out: StrandedCompanyEntry[] = [];
  for (const company of input.companies) {
    if (company.status === "ACTIVE" || company.status === "DISTRESSED") continue;
    const capitalCents = centsOf(company.capital);
    const contracts = input.contracts
      .filter(
        (c) =>
          c.issuerCompanyId === company.id &&
          (c.status === "OPEN" || c.status === "AWARDED" || c.status === "DISPUTED")
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        escrowSovereigns: fromCents(centsOf(c.escrow)),
      }));
    const pendingDecisions = input.decisions
      .filter((d) => d.companyId === company.id)
      .map((d) => ({
        id: d.id,
        type: d.type,
        costSovereigns: fromCents(decisionCostCents(d.payload)),
      }));
    const openOffers = input.proposals
      .map((p) => ({ proposalId: p.id, targetCompanyId: p.companyId, ...acquirePayloadOf(p.payload) }))
      .filter((o) => o.buyerCompanyId === company.id)
      .map((o) => ({
        proposalId: o.proposalId,
        targetCompanyId: o.targetCompanyId,
        offerSovereigns: fromCents(toCents(o.offerAmount)),
      }));

    if (
      capitalCents <= 0 &&
      contracts.length === 0 &&
      pendingDecisions.length === 0 &&
      openOffers.length === 0
    ) {
      continue;
    }

    const totalCents =
      Math.max(0, capitalCents) +
      contracts.reduce((s, c) => s + toCents(c.escrowSovereigns), 0) +
      pendingDecisions.reduce((s, d) => s + toCents(d.costSovereigns), 0) +
      openOffers.reduce((s, o) => s + toCents(o.offerSovereigns), 0);

    out.push({
      companyId: company.id,
      name: company.name,
      status: company.status,
      realmId: company.realmId,
      hqCountryId: company.hqCountryId,
      capitalSovereigns: fromCents(capitalCents),
      contracts,
      pendingDecisions,
      openOffers,
      totalStrandedSovereigns: fromCents(totalCents),
    });
  }
  return out;
}

/** Render a human-readable summary of stranded company escrow in ₷. */
export function formatStrandedEscrowReport(entries: readonly StrandedCompanyEntry[]): string {
  if (entries.length === 0) {
    return "No closed companies have stranded capital, contracts, pending decisions, or acquisition offers.";
  }
  const lines: string[] = [
    `Found ${entries.length} closed compan${entries.length === 1 ? "y" : "ies"} with in-flight or stranded ₷:`,
  ];
  for (const e of entries) {
    const hq = e.hqCountryId ?? "none";
    lines.push(
      `- ${e.name} (${e.companyId}, ${e.status}, realm=${e.realmId}, hq=${hq}): total ${formatSovereigns(e.totalStrandedSovereigns)}`
    );
    if (e.capitalSovereigns > 0) {
      lines.push(`    capital: ${formatSovereigns(e.capitalSovereigns)}`);
    }
    for (const c of e.contracts) {
      lines.push(
        `    contract ${c.id} (${c.status}, "${c.title}"): escrow ${formatSovereigns(c.escrowSovereigns)}`
      );
    }
    for (const d of e.pendingDecisions) {
      lines.push(
        `    pending decision ${d.id} (${d.type}): cost ${formatSovereigns(d.costSovereigns)}`
      );
    }
    for (const o of e.openOffers) {
      lines.push(
        `    open offer ${o.proposalId} -> ${o.targetCompanyId}: ${formatSovereigns(o.offerSovereigns)}`
      );
    }
  }
  return lines.join("\n");
}

export async function loadStrandedCompanies(db: Db): Promise<StrandedCompanyEntry[]> {
  const companies = await db.company.findMany({
    where: { status: { notIn: ["ACTIVE", "DISTRESSED"] } },
    select: {
      id: true,
      name: true,
      status: true,
      realmId: true,
      hqCountryId: true,
      capital: true,
    },
  });
  const ids = companies.map((c) => c.id);
  if (ids.length === 0) return [];
  const [contracts, decisions, proposals] = await Promise.all([
    db.contract.findMany({
      where: {
        issuerCompanyId: { in: ids },
        status: { in: ["OPEN", "AWARDED", "DISPUTED"] },
      },
      select: { id: true, title: true, status: true, issuerCompanyId: true, escrow: true },
    }),
    db.companyDecision.findMany({
      where: { companyId: { in: ids }, appliedIxTime: null },
      select: { id: true, companyId: true, type: true, payload: true },
    }),
    db.companyProposal.findMany({
      where: { type: "ACQUIRE_OFFER", status: "OPEN" },
      select: { id: true, companyId: true, payload: true },
    }),
  ]);
  return selectStrandedCompanies({ companies, contracts, decisions, proposals });
}

function printHelp(): void {
  console.log(
    [
      "Usage: bun scripts/exchange/report-stranded-escrow.ts [--help]",
      "",
      "Read-only report of closed (BANKRUPT / DELISTED) Exchange companies that still hold",
      "non-zero capital, OPEN/AWARDED/DISPUTED contracts they issued, pending decisions, or",
      "open ACQUIRE_OFFER proposals they made as a buyer, with amounts in ₷.",
    ].join("\n")
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  const db = createPrismaClient();
  try {
    const entries = await loadStrandedCompanies(db);
    console.log(formatStrandedEscrowReport(entries));
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

