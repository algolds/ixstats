/**
 * Applies a diplomatic act's `relationshipImpact` to the pair's relation: the one path for an embassy closed,
 * reopened or severed and a diplomatic scenario's choice, so the event that records an impact also moves the
 * relation. Strength stays on its 0-100 scale and the stored band follows it.
 */
import type { PrismaClient } from "@prisma/client";
import { clampStrength, getStandingBand } from "~/lib/diplomacy/relation-bands";

type RelationDb = Pick<PrismaClient, "diplomaticRelation">;

/** Moves the relation between two nations by `impact` points; returns the new strength, or null with no relation. */
export async function applyRelationshipImpact(
  db: RelationDb,
  countryA: string,
  countryB: string,
  impact: number,
  now: Date = new Date()
): Promise<number | null> {
  const relation = await db.diplomaticRelation.findFirst({
    where: {
      OR: [
        { country1: countryA, country2: countryB },
        { country1: countryB, country2: countryA },
      ],
    },
    select: { id: true, strength: true },
  });
  if (!relation) return null;
  const strength = clampStrength(relation.strength + impact);
  if (strength === relation.strength) return strength;
  await db.diplomaticRelation.update({
    where: { id: relation.id },
    data: { strength, relationship: getStandingBand(strength).key, lastContact: now },
  });
  return strength;
}
