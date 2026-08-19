import { db } from "~/server/db";

export interface DiplomaticDriftResult {
  relationsProcessed: number;
  relationsUpdated: number;
}

export async function runDiplomaticDrift(): Promise<DiplomaticDriftResult> {
  const result: DiplomaticDriftResult = {
    relationsProcessed: 0,
    relationsUpdated: 0,
  };

  const relations = await db.diplomaticRelation.findMany({
    where: { status: "active" },
  });

  for (const rel of relations) {
    try {
      result.relationsProcessed++;
      const g1 = rel.goalCountry1;
      const g2 = rel.goalCountry2;

      // Base drift logic based on goals
      let drift = 0;
      let reason = "";

      if (g1 && g2) {
        if (g1 === "ALLY" && g2 === "ALLY") {
          drift = 3;
          reason = "Aligned goals (Alliance pursuit)";
        } else if (g1 === "RIVAL" && g2 === "RIVAL") {
          drift = -3;
          reason = "Mutual rivalry";
        } else if ((g1 === "ALLY" && g2 === "RIVAL") || (g1 === "RIVAL" && g2 === "ALLY")) {
          drift = -2;
          reason = "Pain Point: Direct goal conflict (Ally vs. Rival)";
        } else if (g1 === "COEXIST" && g2 === "COEXIST") {
          drift = 1;
          reason = "Aligned goals (Peaceful coexistence)";
        } else {
          // Oblique goals, e.g., ALLY vs COEXIST, HEGEMONY vs RIVAL
          drift = -0.5;
          reason = `Oblique approaches (${g1} vs. ${g2})`;
        }
      } else {
        // Missing goals: standard slow reversion to neutral (50)
        const target = 50;
        const diff = target - rel.strength;
        if (diff !== 0) {
          drift = diff > 0 ? 0.5 : -0.5;
          reason = "Standard drift toward neutrality";
        }
      }

      // Clamp new strength
      const newStrength = Math.max(0, Math.min(100, Math.round(rel.strength + drift)));

      if (newStrength !== rel.strength || reason !== rel.recentActivity) {
        // Determine relationship category band
        let relationshipBand = rel.relationship;
        if (newStrength > 75) {
          relationshipBand = "ALLIED";
        } else if (newStrength > 50) {
          relationshipBand = "FRIENDLY";
        } else if (newStrength > 30) {
          relationshipBand = "NEUTRAL";
        } else if (newStrength > 10) {
          relationshipBand = "TENSE";
        } else {
          relationshipBand = "HOSTILE";
        }

        await db.diplomaticRelation.update({
          where: { id: rel.id },
          data: {
            strength: newStrength,
            relationship: relationshipBand,
            recentActivity: reason || undefined,
            lastContact: new Date(),
          },
        });
        result.relationsUpdated++;
      }
    } catch (err) {
      console.error(`[DiplomaticDrift] Failed for relation ${rel.id}:`, err);
    }
  }

  return result;
}
