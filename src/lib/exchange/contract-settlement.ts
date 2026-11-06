/**
 * How a contract's escrow leaves it: returned to whoever funded it, or paid to the winning
 * company less any cross-border tariff. Kept apart from contracts.ts, which holds the state
 * machine. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md
 */

import type { Contract } from "@prisma/client";
import { ExchangeError, earnSovereignsTx } from "~/lib/vault/exchange-service";
import { refreshFairValue } from "./companies";
import { round2 } from "./amounts";
import type { Db } from "./guards";
import { tariffOn } from "./tariffs";
import { creditTreasuryTx, transferToTreasuryTx } from "./treasury";

interface Funded {
  id: string;
  realmId: string;
  issuerCompanyId: string | null;
  issuerUserId: string | null;
  issuerCountryId: string | null;
  fundedBy: string | null;
}

async function refundWallet(tx: Db, contract: Funded, amount: number, step: string) {
  if (!contract.issuerUserId) return;
  await earnSovereignsTx(tx, {
    userId: contract.issuerUserId,
    amount,
    type: "CONTRACT_REFUND",
    source: `CONTRACT:${contract.id}`,
    metadata: { contractId: contract.id, step },
    idempotencyKey: `exchange:contract-refund:${contract.id}:${step}`,
  });
}

async function refundTreasury(tx: Db, contract: Funded, amount: number, step: string) {
  if (!contract.issuerCountryId) return;
  await creditTreasuryTx(tx, {
    countryId: contract.issuerCountryId,
    realmId: contract.realmId,
    amount,
    type: "B2G_REFUND",
    source: `CONTRACT:${contract.id}`,
    key: `exchange:contract-refund:${contract.id}:${step}`,
  });
}

async function refundCompany(tx: Db, contract: Funded, amount: number, step: string) {
  if (!contract.issuerCompanyId) return;
  const company = await tx.company.findUnique({
    where: { id: contract.issuerCompanyId },
    select: { status: true, founderId: true },
  });
  if (!company) return;
  if (company.status === "ACTIVE" || company.status === "DISTRESSED") {
    await tx.company.update({
      where: { id: contract.issuerCompanyId },
      data: { capital: { increment: amount } },
    });
    await refreshFairValue(tx, contract.issuerCompanyId);
    return;
  }
  await earnSovereignsTx(tx, {
    userId: contract.issuerUserId ?? company.founderId,
    amount,
    type: "CONTRACT_REFUND",
    source: `CONTRACT:${contract.id}`,
    metadata: { contractId: contract.id, companyId: contract.issuerCompanyId, step },
    idempotencyKey: `exchange:contract-refund:${contract.id}:${step}`,
  });
}

/**
 * Return escrow to whoever funded it: the issuing company's capital, the issuing nation's
 * treasury, or the issuer's wallet, keyed per contract and step so it is credited once.
 * Faucet escrow is burned: nothing takes it back.
 */
export async function refundIssuer(tx: Db, contract: Funded, amount: number, step: string) {
  if (amount <= 0) return;
  switch (contract.fundedBy) {
    case "FAUCET":
      return;
    case "TREASURY":
      return refundTreasury(tx, contract, amount, step);
    case "WALLET":
      return refundWallet(tx, contract, amount, step);
    default:
      return refundCompany(tx, contract, amount, step);
  }
}

/**
 * Standing a completed contract earns the winner: +1, +2 for a government tender in the
 * company's own sector, and +1 more on a tender while a live B2G lobbying buff stands.
 */
function standingGainOf(
  contract: Pick<Contract, "type" | "sectorKey">,
  company: { sectorKey: string; lobbyBuffType: string | null; lobbyBuffUntilIxTime: number | null },
  now: number
): number {
  if (contract.type !== "B2G") return 1;
  const sameSector = company.sectorKey === contract.sectorKey;
  const lobbied = company.lobbyBuffType === "b2g" && (company.lobbyBuffUntilIxTime ?? 0) > now;
  return (sameSector ? 2 : 1) + (lobbied ? 1 : 0);
}

/**
 * Pay escrow to the winning company and record what it earned. A cross-border award pays
 * its tariff out of the payout into the issuing nation's treasury, so the company is credited
 * the whole escrow and then the tariff moves across, in the same transaction.
 */
export async function payContractor(
  tx: Db,
  contract: Contract,
  amount: number
): Promise<{ net: number; tariffPaid: number }> {
  const companyId = contract.winnerCompanyId!;
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Contractor not found");
  if (company.status !== "ACTIVE" && company.status !== "DISTRESSED") {
    throw new ExchangeError("CONFLICT", "Contractor is no longer operating");
  }
  const delta = standingGainOf(contract, company, Date.now());
  const tariff = await tariffOn(tx, contract, company.hqCountryId, amount);
  const tariffPaid = tariff?.amount ?? 0;
  await tx.company.update({
    where: { id: companyId },
    data: {
      capital: { increment: amount },
      contractsWonValue: { increment: amount },
      standing: { increment: delta },
    },
  });
  if (tariff) {
    await transferToTreasuryTx(tx, {
      from: { kind: "COMPANY", companyId },
      countryId: tariff.countryId,
      realmId: contract.realmId,
      amount: tariff.amount,
      type: "TARIFF",
      source: `TARIFF:${contract.id}`,
      key: `exchange:contract-tariff:${contract.id}`,
    });
  }
  await tx.contract.update({
    where: { id: contract.id },
    data: { tariffRate: tariff?.rate ?? 0, tariffPaid },
  });
  if (contract.awardedBidId) {
    await tx.contractBid.update({
      where: { id: contract.awardedBidId },
      data: { standingDelta: delta },
    });
  }
  await refreshFairValue(tx, companyId);
  return { net: round2(amount - tariffPaid), tariffPaid };
}
