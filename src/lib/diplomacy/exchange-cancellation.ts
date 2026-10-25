/**
 * Cancelling a cultural exchange in planning costs the host: each participant's relation drops by the relationship
 * penalty (and a "High" cultural-exchange level falls to "Medium"), the host's embassies in the participants'
 * countries lose the reputation penalty (never below 0), and each participant is notified.
 */
import type { PrismaClient } from "@prisma/client";
import { clampStrength, getStandingBand } from "~/lib/diplomacy/relation-bands";
import { notificationAPI } from "~/lib/notifications/api";

export interface CancellationPenalties {
  /** Negative: the reputation each host embassy in a participant's country loses. */
  reputationLoss: number;
  /** Relation strength points each participant's relation loses. */
  relationshipPenalty: number;
  affectedCountries: number;
}

export function cancellationPenalties(participantCount: number): CancellationPenalties {
  return {
    reputationLoss: -10 - 5 * participantCount,
    relationshipPenalty: Math.min(20, 5 + participantCount * 3),
    affectedCountries: participantCount,
  };
}

type CancelDb = Pick<PrismaClient, "diplomaticRelation" | "embassy" | "country">;

async function penaliseRelation(
  db: CancelDb,
  hostCountryId: string,
  participantId: string,
  penalty: number
) {
  const relationship = await db.diplomaticRelation.findFirst({
    where: {
      OR: [
        { country1: hostCountryId, country2: participantId },
        { country1: participantId, country2: hostCountryId },
      ],
    },
  });
  if (!relationship) return;
  const strength = clampStrength(relationship.strength - penalty);
  await db.diplomaticRelation.update({
    where: { id: relationship.id },
    data: {
      strength,
      relationship: getStandingBand(strength).key,
      culturalExchange:
        relationship.culturalExchange === "High" ? "Medium" : relationship.culturalExchange,
      updatedAt: new Date(),
    },
  });
}

async function penaliseReputation(
  db: CancelDb,
  hostCountryId: string,
  participantId: string,
  loss: number
) {
  const embassies = await db.embassy.findMany({
    where: { guestCountryId: hostCountryId, hostCountryId: participantId },
    select: { id: true, reputation: true },
  });
  for (const embassy of embassies) {
    await db.embassy.update({
      where: { id: embassy.id },
      data: { reputation: Math.max(0, embassy.reputation + loss) },
    });
  }
}

/** Applies the penalties of cancelling `exchange` (already marked cancelled) and notifies its participants. */
export async function applyExchangeCancellation(
  db: CancelDb,
  exchange: {
    id: string;
    title: string;
    hostCountryId: string;
    participatingCountries: Array<{ countryId: string }>;
  }
): Promise<CancellationPenalties> {
  const penalties = cancellationPenalties(exchange.participatingCountries.length);
  const host = await db.country.findUnique({
    where: { id: exchange.hostCountryId },
    select: { name: true },
  });

  for (const { countryId } of exchange.participatingCountries) {
    try {
      await penaliseRelation(db, exchange.hostCountryId, countryId, penalties.relationshipPenalty);
      await penaliseReputation(db, exchange.hostCountryId, countryId, penalties.reputationLoss);
    } catch (error) {
      console.error(`[CulturalExchange] Failed to apply the penalty to ${countryId}:`, error);
    }
    try {
      await notificationAPI.create({
        title: "Cultural exchange cancelled",
        message: `${host?.name ?? "The host nation"} cancelled ${exchange.title}`,
        countryId,
        category: "diplomatic",
        priority: "medium",
        href: "/mycountry/diplomacy",
        source: "diplomatic-system",
        actionable: false,
        metadata: { exchangeId: exchange.id, hostCountryId: exchange.hostCountryId },
      });
    } catch (error) {
      console.error(`[CulturalExchange] Failed to notify ${countryId}:`, error);
    }
  }

  return penalties;
}
