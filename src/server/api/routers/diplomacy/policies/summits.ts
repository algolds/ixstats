import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { assertSameRealm } from "~/server/shared/same-realm-guard";
import { clockForCountry } from "~/server/shared/realm-time";
import { expireStaleDiplomaticProposals } from "~/lib/diplomacy/proposal-lifecycle";
import { getStandingBand } from "~/lib/diplomacy/relation-bands";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import {
  SUMMIT_AGENDA_MAX,
  SUMMIT_RELATION_BOOST,
  SUMMIT_TYPE,
  SUMMIT_WHEN_KEYS,
  summitDate,
  summitPhase,
} from "~/lib/diplomacy/summits";
import { notifyCountryOwners } from "./notify";

/** Advisory-lock namespace serialising one pair's summit proposals, so two cannot both pass the open check. */
const SUMMIT_LOCK_NAMESPACE = 51003;

const pairWhere = (a: string, b: string) => ({
  OR: [
    { initiatorId: a, targetId: b },
    { initiatorId: b, targetId: a },
  ],
});

/**
 * The target agrees to a summit: claimed atomically (a concurrent decline or second accept loses), relations
 * warm by SUMMIT_RELATION_BOOST, and the proposer is told. A summit whose date has already passed cannot be
 * agreed to and is marked expired.
 */
export async function acceptSummit(db: PrismaClient, actionId: string) {
  const summit = await db.foreignPolicyAction.findUnique({
    where: { id: actionId },
    select: {
      id: true,
      initiatorId: true,
      targetId: true,
      effectiveIxTime: true,
      relationshipDelta: true,
      target: { select: { name: true } },
    },
  });
  if (!summit) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
  const clock = await clockForCountry(db, summit.initiatorId);
  if (summitPhase(summit.effectiveIxTime, clock.now()) === "held") {
    await db.foreignPolicyAction.updateMany({
      where: { id: summit.id, status: "proposed" },
      data: { status: "expired" },
    });
    throw new TRPCError({ code: "BAD_REQUEST", message: "This summit's date has already passed." });
  }

  const relation = await db.diplomaticRelation.findFirst({
    where: {
      OR: [
        { country1: summit.initiatorId, country2: summit.targetId },
        { country1: summit.targetId, country2: summit.initiatorId },
      ],
    },
  });
  const agreed = await db.$transaction(async (tx) => {
    const claimed = await tx.foreignPolicyAction.updateMany({
      where: { id: summit.id, status: "proposed" },
      data: { status: "active" },
    });
    if (claimed.count === 0) return false;
    if (relation) {
      const strength = Math.min(100, (relation.strength ?? 50) + summit.relationshipDelta);
      await tx.diplomaticRelation.update({
        where: { id: relation.id },
        data: { strength, relationship: getStandingBand(strength).key, lastContact: new Date() },
      });
    }
    return true;
  });
  if (!agreed)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is no longer pending." });

  const date = summit.effectiveIxTime
    ? formatRealmDate(summit.effectiveIxTime, clock.calendar)
    : "";
  await notifyCountryOwners(db, [summit.initiatorId], {
    title: "Summit agreed",
    message: `${summit.target.name} agreed to your summit${date ? ` on ${date}` : ""}.`,
    type: "success",
    priority: "high",
    metadata: { foreignPolicyActionId: summit.id, actionType: SUMMIT_TYPE },
  });
  return { status: "active" as const };
}

export const diplomaticPoliciesSummitsRouter = createTRPCRouter({
  /** Propose a summit to another nation of the same realm; its owner accepts or declines in the inbox. */
  proposeSummit: rateLimitedMutationProcedure
    .input(
      z.object({
        targetId: z.string().min(1),
        when: z.enum(SUMMIT_WHEN_KEYS),
        agenda: z.string().trim().max(SUMMIT_AGENDA_MAX).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const initiatorId = ctx.user?.countryId;
      if (!initiatorId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need a nation to propose a summit.",
        });
      }
      if (initiatorId === input.targetId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A nation cannot hold a summit with itself.",
        });
      }
      const db = ctx.db as PrismaClient;
      await assertSameRealm(db, initiatorId, input.targetId);
      await expireStaleDiplomaticProposals(db, { countryId: initiatorId });

      const clock = await clockForCountry(db, initiatorId);
      const now = clock.now();
      const lockKey = `${[initiatorId, input.targetId].sort().join(":")}:${SUMMIT_TYPE}`;
      const created = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUMMIT_LOCK_NAMESPACE}::int, hashtext(${lockKey}))`;
        const open = await tx.foreignPolicyAction.findFirst({
          where: {
            actionType: SUMMIT_TYPE,
            AND: [
              pairWhere(initiatorId, input.targetId),
              { OR: [{ status: "proposed" }, { status: "active", effectiveIxTime: { gt: now } }] },
            ],
          },
          select: { id: true },
        });
        if (open) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A summit with this nation is already proposed or scheduled.",
          });
        }
        return tx.foreignPolicyAction.create({
          data: {
            initiatorId,
            targetId: input.targetId,
            actionType: SUMMIT_TYPE,
            category: "diplomatic",
            severity: "light",
            status: "proposed",
            effectiveIxTime: summitDate(now, input.when),
            relationshipDelta: SUMMIT_RELATION_BOOST,
            description: input.agenda || null,
          },
          include: {
            initiator: { select: { name: true } },
            target: { select: { name: true } },
          },
        });
      });

      const date = formatRealmDate(created.effectiveIxTime ?? now, clock.calendar);
      await notifyCountryOwners(db, [input.targetId], {
        title: "Summit proposed",
        message: `${created.initiator.name} proposes a summit on ${date}. Answer it in your diplomacy inbox.`,
        priority: "high",
        metadata: { foreignPolicyActionId: created.id, actionType: SUMMIT_TYPE },
      });
      return { id: created.id, effectiveIxTime: created.effectiveIxTime };
    }),

  /** A nation's agreed summits, upcoming ones first (soonest first), then the most recently held. */
  getSummits: publicProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.foreignPolicyAction.findMany({
        where: {
          actionType: SUMMIT_TYPE,
          status: "active",
          OR: [{ initiatorId: input.countryId }, { targetId: input.countryId }],
        },
        orderBy: { effectiveIxTime: "desc" },
        take: 20,
        include: {
          initiator: { select: { id: true, name: true, flag: true, slug: true } },
          target: { select: { id: true, name: true, flag: true, slug: true } },
        },
      });
      const now = (await clockForCountry(ctx.db as PrismaClient, input.countryId)).now();
      const summits = rows.map((r) => ({
        id: r.id,
        partner: r.initiatorId === input.countryId ? r.target : r.initiator,
        proposedByUs: r.initiatorId === input.countryId,
        dateIxTime: r.effectiveIxTime,
        agenda: r.description,
        phase: summitPhase(r.effectiveIxTime, now),
      }));
      const upcoming = summits.filter((s) => s.phase === "upcoming").reverse();
      return [...upcoming, ...summits.filter((s) => s.phase === "held")];
    }),
});
