/**
 * Alliance invite helpers shared by the alliances router: who speaks for an invite, and how an
 * NPC (unowned) nation answers one.
 */
import type { CumulativeEffects } from "~/lib/diplomacy/choice-tracker";
import { NPCPersonalitySystem } from "~/lib/diplomacy/npc-personality";
import {
  buildNpcObservableData,
  toMarkovState,
  type NpcEmbassyRow,
  type NpcRelationRow,
} from "~/lib/diplomacy/npc-observable-data";
import { INVITE_STATUS } from "~/lib/diplomacy/proposal-lifecycle";
import { notifyCountryOwners } from "./notify";

export const ALLIANCE_LEADER_ROLES = ["founder", "leader"];

/**
 * The countries that speak for a pending invite: the country that issued it, or — for
 * invites issued before `invitedByCountryId` was recorded — the alliance's active leadership.
 */
export async function inviteProposerCountryIds(
  db: any,
  invite: { allianceId: string; invitedByCountryId?: string | null }
): Promise<string[]> {
  if (invite.invitedByCountryId) return [invite.invitedByCountryId];
  const leaders: { countryId: string }[] = await db.allianceMember.findMany({
    where: {
      allianceId: invite.allianceId,
      isActive: true,
      role: { in: ALLIANCE_LEADER_ROLES },
    },
    select: { countryId: true },
  });
  return leaders.map((l) => l.countryId);
}

/** Player reputation is not tracked yet; the alliance prediction does not read it. */
const NEUTRAL_REPUTATION: CumulativeEffects = {
  reputationModifier: 0,
  trustLevel: 50,
  predictability: 50,
  aggressiveness: 50,
  cooperativeness: 50,
  culturalDiplomacyScore: 50,
  exchangeSuccessRate: 50,
  historicalPatterns: {
    favorsAlliances: false,
    prefersTrade: false,
    culturallyActive: false,
    interventionist: false,
    isolationist: false,
    multilateral: false,
  },
};

/**
 * Deterministic NPC answer to an alliance invite: the personality's alliance prediction, where
 * only an outright "accept" joins (negotiate / defer / reject all decline — an NPC cannot
 * counter-propose terms).
 */
export function decideNpcAllianceInvite(input: {
  countryId: string;
  countryName: string;
  inviterCountryId: string | null;
  relationships: NpcRelationRow[];
  embassies: NpcEmbassyRow[];
}): { choice: "accept" | "decline"; reasoning: string[] } {
  const personality = NPCPersonalitySystem.calculatePersonality(
    input.countryId,
    input.countryName,
    buildNpcObservableData(input.relationships, input.embassies)
  );
  const withInviter = input.inviterCountryId
    ? input.relationships.find(
        (r) =>
          (r.country1 === input.countryId && r.country2 === input.inviterCountryId) ||
          (r.country2 === input.countryId && r.country1 === input.inviterCountryId)
      )
    : undefined;
  const prediction = NPCPersonalitySystem.predictResponse(personality, "alliance_proposal", {
    currentRelationship: toMarkovState(withInviter?.relationship),
    relationshipStrength: withInviter?.strength ?? 50,
    playerReputation: NEUTRAL_REPUTATION,
    recentPlayerActions: [],
  });
  return {
    choice: prediction.predictedAction === "accept" ? "accept" : "decline",
    reasoning: prediction.reasoning,
  };
}

/**
 * When the invited country is an NPC — no `ownerUserId` and no user acting as it — answer the
 * pending invite straight away, so it never waits out the expiry window for a reply that can't
 * come. Returns the invite's new status, or null when a player must answer it.
 */
export async function autoRespondNpcAllianceInvite(
  db: any,
  invite: { id: string; allianceId: string; countryId: string; invitedByCountryId: string | null }
): Promise<"active" | "declined" | null> {
  const country = await db.country.findUnique({
    where: { id: invite.countryId },
    select: { id: true, name: true, ownerUserId: true },
  });
  if (!country || country.ownerUserId) return null;
  const actingUser = await db.user.findFirst({
    where: { countryId: invite.countryId },
    select: { id: true },
  });
  if (actingUser) return null;

  const [relationships, embassies] = await Promise.all([
    db.diplomaticRelation.findMany({
      where: { OR: [{ country1: invite.countryId }, { country2: invite.countryId }] },
      select: {
        country1: true,
        country2: true,
        relationship: true,
        strength: true,
        culturalExchange: true,
      },
    }),
    db.embassy.findMany({
      where: { OR: [{ guestCountryId: invite.countryId }, { hostCountryId: invite.countryId }] },
      select: { specialization: true, level: true, influence: true },
    }),
  ]);
  const { choice } = decideNpcAllianceInvite({
    countryId: invite.countryId,
    countryName: country.name,
    inviterCountryId: invite.invitedByCountryId,
    relationships: relationships ?? [],
    embassies: embassies ?? [],
  });

  const accepted = choice === "accept";
  const claimed = await db.allianceMember.updateMany({
    where: { id: invite.id, status: INVITE_STATUS.pending },
    data: accepted
      ? { isActive: true, status: INVITE_STATUS.accepted, joinedAt: new Date() }
      : { isActive: false, status: INVITE_STATUS.declined },
  });
  if (claimed.count === 0) return null;

  if (accepted) {
    const count = await db.allianceMember.count({
      where: { allianceId: invite.allianceId, isActive: true },
    });
    await db.alliance.update({ where: { id: invite.allianceId }, data: { memberCount: count } });
  }

  const [alliance, proposerIds] = await Promise.all([
    db.alliance.findUnique({ where: { id: invite.allianceId }, select: { name: true } }),
    inviteProposerCountryIds(db, invite),
  ]);
  const allianceName = alliance?.name ?? "the alliance";
  await notifyCountryOwners(db, proposerIds, {
    title: accepted ? "Alliance Invitation Accepted" : "Alliance Invitation Declined",
    message: accepted
      ? `${country.name} accepted the invitation and joined ${allianceName}.`
      : `${country.name} declined the invitation to join ${allianceName}.`,
    type: accepted ? "success" : "warning",
    metadata: { allianceId: invite.allianceId, countryId: invite.countryId },
  });
  return accepted ? INVITE_STATUS.accepted : INVITE_STATUS.declined;
}
