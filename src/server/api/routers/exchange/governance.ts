/**
 * Exchange governance procedures: a company's shareholder proposals and their votes, and the
 * acquisition offers open against a company.
 * Mutations are rate limited and act as the signed-in user. The governance lib checks the Exchange
 * flag inside its transaction; openProposal takes a client `requestId`, so a retry is applied once.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { acquirePayloadOf } from "~/lib/exchange/acquisition";
import {
  castVote,
  listProposals,
  openProposal,
  PROPOSAL_TYPES,
  type OwnerProposalType,
  type ProposalType,
} from "~/lib/exchange/governance";
import { MAX_SHARES_ISSUED } from "~/lib/exchange/shares";
import { guard } from "./_errors";

const id = z.string().min(1);
const requestId = z.string().min(8).max(64);

/**
 * An acquisition offer comes from an ACQUIRE decision, which escrows the offer and waits a day. A
 * founder can't open one directly, so the proposal form refuses it here.
 */
function ownerProposalTypeOf(type: ProposalType): OwnerProposalType {
  if (type === "ACQUIRE_OFFER") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "An acquisition offer is made with an ACQUIRE decision",
    });
  }
  return type;
}

export const exchangeGovernanceRouter = createTRPCRouter({
  /** A company's recent proposals (open and closed), each with the caller's own ballot. */
  listProposals: protectedProcedure.input(z.object({ companyId: id })).query(({ ctx, input }) =>
    guard("load the proposals", async () => {
      const proposals = await listProposals(ctx.db, input.companyId);
      const ballots = await ctx.db.companyVote.findMany({
        where: { voterUserId: ctx.user.id, proposalId: { in: proposals.map((p) => p.id) } },
        select: { proposalId: true, support: true, shares: true },
      });
      const mine = new Map(
        ballots.map((b) => [b.proposalId, { support: b.support, shares: b.shares }])
      );
      return proposals.map((p) => ({ ...p, myVote: mine.get(p.id) ?? null }));
    })
  ),

  /** Open a shareholder proposal the founder asked for. It executes at once when the founder holds more than half. */
  openProposal: rateLimitedMutationProcedure
    .input(
      z.object({
        companyId: id,
        type: z.enum(PROPOSAL_TYPES),
        shares: z.number().int().min(1).max(MAX_SHARES_ISSUED).optional(),
        targetCompanyId: id.optional(),
        offerAmount: z.number().int().min(1).max(10_000_000).optional(),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("open the proposal", () =>
        openProposal(ctx.db, {
          userId: ctx.user.id,
          companyId: input.companyId,
          type: ownerProposalTypeOf(input.type),
          shares: input.shares,
          requestId: input.requestId,
        })
      )
    ),

  /** Cast or change my ballot on an open proposal. */
  castVote: rateLimitedMutationProcedure
    .input(z.object({ proposalId: id, support: z.boolean() }))
    .mutation(({ ctx, input }) =>
      guard("cast the vote", () => castVote(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  /** The open acquisition offers against a company, with the buyer and the offer. */
  getAcquisitionOffers: protectedProcedure
    .input(z.object({ companyId: id }))
    .query(({ ctx, input }) =>
      guard("load the acquisition offers", async () => {
        const offers = await ctx.db.companyProposal.findMany({
          where: { companyId: input.companyId, type: "ACQUIRE_OFFER", status: "OPEN" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            proposerUserId: true,
            payload: true,
            sharesFor: true,
            sharesAgainst: true,
            totalEligibleShares: true,
            expiresIxTime: true,
            createdAt: true,
          },
        });
        return offers.map(({ payload, ...offer }) => ({
          ...offer,
          offer: acquirePayloadOf(payload),
        }));
      })
    ),
});
