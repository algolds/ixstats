import { db } from "~/server/db";
import { expireStaleDiplomaticProposals } from "~/lib/diplomacy/proposal-lifecycle";
import { closeDueEmbassyMissions } from "~/lib/diplomacy/embassy-mission-sweep";
import { advanceCulturalExchanges } from "~/lib/diplomacy/cultural-exchange-lifecycle";
import { expireHostileForeignPolicyActions } from "~/lib/diplomacy/foreign-policy-effects";
import { planRelationDrift } from "~/lib/diplomacy/relation-drift";
import { findAllById } from "~/lib/system/find-all-by-id";

interface DiplomaticDriftResult {
  relationsProcessed: number;
  relationsUpdated: number;
  proposalsExpired: number;
  invitesExpired: number;
  hostileActionsExpired: number;
  exchangesActivated: number;
  exchangesCompleted: number;
  missionsCompleted: number;
  missionsCancelled: number;
}

/** Runs one sweep, logging (not throwing) a failure so the rest of the job still runs. */
async function sweep<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.error(`[DiplomaticDrift] ${name} failed:`, err);
    return null;
  }
}

export async function runDiplomaticDrift(): Promise<DiplomaticDriftResult> {
  const now = new Date();
  // Pending proposals / alliance invites past their answer window (also enforced lazily).
  const expired = await sweep("Proposal expiry sweep", () => expireStaleDiplomaticProposals(db));
  // Sanctions, embargoes and blockades whose effect window has closed.
  const hostile = await sweep("Hostile action expiry", () => expireHostileForeignPolicyActions(db));
  // Cultural exchanges: planning → active → completed, metrics refreshed.
  const exchanges = await sweep("Cultural exchange lifecycle", () =>
    advanceCulturalExchanges(db, now)
  );
  // Cultural-exchange embassy missions that are due (rewards paid) or whose exchange was cancelled.
  const missions = await sweep("Embassy mission sweep", () => closeDueEmbassyMissions(db, now));

  const result: DiplomaticDriftResult = {
    relationsProcessed: 0,
    relationsUpdated: 0,
    proposalsExpired: expired?.proposalsExpired ?? 0,
    invitesExpired: expired?.invitesExpired ?? 0,
    hostileActionsExpired: hostile ?? 0,
    exchangesActivated: exchanges?.exchangesActivated ?? 0,
    exchangesCompleted: exchanges?.exchangesCompleted ?? 0,
    missionsCompleted: missions?.missionsCompleted ?? 0,
    missionsCancelled: missions?.missionsCancelled ?? 0,
  };

  const relations = await findAllById((page) =>
    db.diplomaticRelation.findMany({ where: { status: "active" }, ...page })
  );

  for (const rel of relations) {
    try {
      result.relationsProcessed++;
      const update = planRelationDrift(rel, Math.random, now);
      if (!update) continue;
      await db.diplomaticRelation.update({ where: { id: rel.id }, data: update });
      result.relationsUpdated++;
    } catch (err) {
      console.error(`[DiplomaticDrift] Failed for relation ${rel.id}:`, err);
    }
  }

  return result;
}
