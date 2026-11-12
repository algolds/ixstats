/**
 * Unwind a company's in-flight money into its capital before liquidation or dissolution:
 *   1. Pre-award (OPEN) contracts the company issued: cancel them, mark their bids LOST, and
 *      return their escrow to company capital.
 *   2. Open ACQUIRE_OFFER proposals the company made as a buyer: expire them and return their
 *      escrowed offer amount to company capital.
 *   3. Pending (unapplied) decisions queued on the company: refund the burned portion of their
 *      cost (for LOBBY with an HQ, the half not sent to the treasury; for all other decisions,
 *      the full cost) to company capital and mark them applied with `{ refunded: burned }`.
 * Returns the total ₷ credited back to the company's capital.
 */

import type { Prisma } from "@prisma/client";
import { centsOf, dbCents, fromCents, toCents } from "./amounts";
import { acquirePayloadOf, returnOfferTx } from "./acquisition";
import { refundIssuer } from "./contract-settlement";
import type { DecisionPayload } from "./decisions";
import type { Db } from "./guards";

function burnedDecisionCostCents(
  type: string,
  payload: Prisma.JsonValue,
  hqCountryId: string | null
): number {
  const record = (payload ?? {}) as Partial<DecisionPayload>;
  const cost = Number(record.cost ?? 0);
  const costCents = toCents(cost);
  if (costCents <= 0) return 0;
  const toTreasuryCents = type === "LOBBY" && hqCountryId ? Math.round(costCents / 2) : 0;
  return costCents - toTreasuryCents;
}

export async function unwindCompanyMoneyTx(
  tx: Db,
  companyId: string,
  nowMs: number
): Promise<number> {
  let returnedCents = 0;

  const openContracts = await tx.contract.findMany({
    where: { issuerCompanyId: companyId, status: "OPEN" },
  });
  for (const contract of openContracts) {
    const { count } = await tx.contract.updateMany({
      where: { id: contract.id, status: "OPEN" },
      data: { status: "CANCELLED", escrow: 0n, closedIxTime: nowMs },
    });
    if (count !== 1) continue;
    await tx.contractBid.updateMany({
      where: { contractId: contract.id },
      data: { outcome: "LOST" },
    });
    const escrowCents = centsOf(contract.escrow);
    if (escrowCents > 0) {
      await refundIssuer(tx, contract, fromCents(escrowCents), "close");
      if (
        contract.fundedBy !== "FAUCET" &&
        contract.fundedBy !== "TREASURY" &&
        contract.fundedBy !== "WALLET"
      ) {
        returnedCents += escrowCents;
      }
    }
  }

  const openOffers = await tx.companyProposal.findMany({
    where: { type: "ACQUIRE_OFFER", status: "OPEN" },
  });
  for (const proposal of openOffers) {
    const { buyerCompanyId, offerAmount } = acquirePayloadOf(proposal.payload);
    if (buyerCompanyId !== companyId) continue;
    const { count } = await tx.companyProposal.updateMany({
      where: { id: proposal.id, status: "OPEN" },
      data: { status: "EXPIRED", resolvedIxTime: nowMs },
    });
    if (count !== 1 || offerAmount <= 0) continue;
    await returnOfferTx(tx, {
      companyId,
      amount: offerAmount,
      key: `exchange:acquire-return:${proposal.id}`,
    });
    returnedCents += toCents(offerAmount);
  }

  const pendingDecisions = await tx.companyDecision.findMany({
    where: { companyId, appliedIxTime: null },
  });
  if (pendingDecisions.length > 0) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { hqCountryId: true },
    });
    const hqCountryId = company?.hqCountryId ?? null;
    for (const decision of pendingDecisions) {
      const burnedCents = burnedDecisionCostCents(decision.type, decision.payload, hqCountryId);
      const { count } = await tx.companyDecision.updateMany({
        where: { id: decision.id, appliedIxTime: null },
        data: { appliedIxTime: nowMs, effect: { refunded: fromCents(burnedCents) } },
      });
      if (count !== 1 || burnedCents <= 0) continue;
      await tx.company.update({
        where: { id: companyId },
        data: { capital: { increment: dbCents(burnedCents) } },
      });
      returnedCents += burnedCents;
    }
  }

  return fromCents(returnedCents);
}
