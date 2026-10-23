/**
 * Admin: wiki name claims (IxnayID design decisions 3-5): the queue with each name's evidence, approve, reject and
 * remove, the direct link of an old name to an account, and the legacy name search. Thin: the claims service decides,
 * `identity.name-search.ts` reads.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { WikiNameClaimStatus } from "@prisma/client";
import { isSystemOwner } from "~/lib/auth";
import { MAX_CLAIM_NAME_LENGTH } from "~/lib/identity/wiki-names";
import { fetchClassicWikiUsers } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  type ClaimActor,
  createNameClaimService,
  NAME_CLAIM_HTTP,
  NameClaimError,
} from "~/server/modules/identity/identity.name-claims";
import {
  findLinkTargets,
  listClaimQueue,
  searchLegacyNames,
} from "~/server/modules/identity/identity.name-search";

const id = z.string().min(1).max(64);
const note = z.string().trim().max(1000).nullish();
const DecisionInput = z.object({ claimId: id, note });

interface AdminCtx {
  auth: { userId: string | null } | null;
  user: { id: string; clerkUserId: string };
}

const actorOf = (ctx: AdminCtx): ClaimActor => ({
  userId: ctx.user.id,
  clerkUserId: ctx.user.clerkUserId,
  isSystemOwner: isSystemOwner(ctx.auth?.userId ?? ""),
});

/** The service's refusals as tRPC errors, its message kept. */
async function decide<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NameClaimError) {
      throw new TRPCError({ code: NAME_CLAIM_HTTP[error.code], message: error.message });
    }
    throw error;
  }
}

export const adminNameClaimsRouter = createTRPCRouter({
  listNameClaims: adminProcedure
    .input(
      z.object({
        status: z.enum(WikiNameClaimStatus).default("PENDING"),
        cursor: id.nullish(),
        limit: z.number().int().min(1).max(50).default(25),
      })
    )
    .query(async ({ ctx, input }) => ({
      ...(await listClaimQueue(ctx.db, {
        status: input.status,
        cursor: input.cursor ?? null,
        limit: input.limit,
      })),
      viewerIsSystemOwner: actorOf(ctx).isSystemOwner,
    })),

  searchLegacyWikiNames: adminProcedure
    .input(
      z.object({
        query: z.string().min(1).max(MAX_CLAIM_NAME_LENGTH),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(({ ctx, input }) =>
      searchLegacyNames(
        ctx.db,
        { fetchClassicUsers: fetchClassicWikiUsers },
        input.query,
        input.limit
      )
    ),

  findNameLinkTargets: adminProcedure
    .input(z.object({ query: z.string().min(1).max(64) }))
    .query(({ ctx, input }) => findLinkTargets(ctx.db, input.query)),

  approveNameClaim: adminProcedure.input(DecisionInput).mutation(({ ctx, input }) =>
    decide(() =>
      createNameClaimService(ctx.db).approve(actorOf(ctx), {
        claimId: input.claimId,
        note: input.note ?? null,
      })
    )
  ),

  rejectNameClaim: adminProcedure.input(DecisionInput).mutation(({ ctx, input }) =>
    decide(() =>
      createNameClaimService(ctx.db).reject(actorOf(ctx), {
        claimId: input.claimId,
        note: input.note ?? null,
      })
    )
  ),

  revokeNameClaim: adminProcedure.input(DecisionInput).mutation(({ ctx, input }) =>
    decide(() =>
      createNameClaimService(ctx.db).revoke(actorOf(ctx), {
        claimId: input.claimId,
        note: input.note ?? null,
      })
    )
  ),

  linkLegacyWikiName: adminProcedure
    .input(
      z.object({
        userId: id,
        name: z.string().min(1).max(MAX_CLAIM_NAME_LENGTH),
        note,
        mwUserId: z.number().int().positive().nullish(),
      })
    )
    .mutation(({ ctx, input }) =>
      decide(() =>
        createNameClaimService(ctx.db).adminLink(actorOf(ctx), {
          userId: input.userId,
          name: input.name,
          note: input.note ?? null,
          mwUserId: input.mwUserId ?? null,
        })
      )
    ),
});
