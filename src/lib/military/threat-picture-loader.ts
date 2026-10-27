/**
 * Loads what `deriveThreatPicture` needs for one nation. Read-only: neighbours come from the
 * political map (`resolveNeighbors`, cached, empty without a map layer), the rest from conflicts,
 * foreign-policy actions and crises. Combat power comes from the defense model through
 * `readStrengths` (the defense module's `nationalCombatPower`), and foreign-policy expiry is read
 * against the nation's realm clock (`nowClockMs`).
 */
import type { PrismaClient } from "@prisma/client";
import { COOPERATIVE_FP_TYPES } from "~/lib/diplomacy/proposal-lifecycle";
import { parseAffectedCountries } from "~/lib/maps/crisis-affected-countries";
import { resolveNeighbors } from "~/lib/national-issues/neighbors";
import { withPvPExpiry } from "./pvp-proposals";
import { deriveThreatPicture, type ThreatPicture } from "./threat-picture";

/** Crisis response states that count as still active (as in `crisisEvents.getActive`). */
const ACTIVE_CRISIS_STATUSES = ["pending", "in_progress", "monitoring"];

export interface ThreatPictureSources {
  /** Combat power of each nation (derived, on its realm clock). */
  readStrengths: (countryIds: readonly string[]) => Promise<Record<string, number>>;
  /** The nation's realm clock now. */
  nowClockMs: number;
}

export async function loadThreatPicture(
  db: PrismaClient,
  countryId: string,
  sources: ThreatPictureSources
): Promise<ThreatPicture> {
  const nowIx = sources.nowClockMs;
  const [neighbors, relations, conflictRows, actions, crisisRows] = await Promise.all([
    resolveNeighbors(countryId, db),
    db.diplomaticRelation.findMany({
      where: { OR: [{ country1: countryId }, { country2: countryId }] },
      select: { country1: true, country2: true, strength: true },
    }),
    db.militaryConflict.findMany({
      where: {
        status: { in: ["proposed", "active"] },
        OR: [{ initiatorId: countryId }, { defenderId: countryId }],
      },
      include: {
        initiator: { select: { name: true } },
        defender: { select: { name: true } },
      },
    }),
    db.foreignPolicyAction.findMany({
      where: {
        targetId: countryId,
        status: "active",
        actionType: { notIn: [...COOPERATIVE_FP_TYPES] },
        OR: [{ expiryIxTime: null }, { expiryIxTime: { gt: nowIx } }],
      },
      include: { initiator: { select: { name: true } } },
    }),
    db.crisisEvent.findMany({
      where: {
        responseStatus: { in: ACTIVE_CRISIS_STATUSES },
        affectedCountries: { contains: countryId },
      },
      select: { id: true, title: true, severity: true, timestamp: true, affectedCountries: true },
    }),
  ]);

  const relationWith = new Map(
    relations.map((r) => [r.country1 === countryId ? r.country2 : r.country1, r.strength])
  );
  const neighborList = [
    ...new Map(
      neighbors
        .filter((n): n is { name: string; countryId: string } => !!n.countryId)
        .filter((n) => n.countryId !== countryId)
        .map((n) => [n.countryId, n])
    ).values(),
  ];
  const conflicts = conflictRows
    .map(withPvPExpiry)
    .filter((c) => c.status === "proposed" || c.status === "active")
    .map((c) => {
      const mine = c.initiatorId === countryId;
      return {
        id: c.id,
        type: c.type,
        status: c.status,
        opponentId: mine ? c.defenderId : c.initiatorId,
        opponentName: (mine ? c.defender?.name : c.initiator?.name) ?? "another nation",
        detectedAt: c.startDate ?? c.createdAt,
      };
    });

  const neighborIds = neighborList.map((n) => n.countryId);
  const rivalIds = [
    ...new Set([...conflicts.map((c) => c.opponentId), ...actions.map((a) => a.initiatorId)]),
  ].filter((id) => !neighborIds.includes(id));
  const strengths = await sources.readStrengths([countryId, ...neighborIds, ...rivalIds]);

  return deriveThreatPicture({
    ownStrength: strengths[countryId] ?? 0,
    neighbors: neighborList.map((n) => ({
      countryId: n.countryId,
      name: n.name,
      strength: strengths[n.countryId] ?? 0,
      relationStrength: relationWith.get(n.countryId) ?? null,
    })),
    conflicts,
    hostileActions: actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      severity: a.severity,
      initiatorId: a.initiatorId,
      initiatorName: a.initiator?.name ?? "another nation",
      detectedAt: a.createdAt,
    })),
    crises: crisisRows
      .filter((c) => parseAffectedCountries(c.affectedCountries).includes(countryId))
      .map((c) => ({ id: c.id, title: c.title, severity: c.severity, detectedAt: c.timestamp })),
    rivalStrengths: Object.fromEntries(rivalIds.map((id) => [id, strengths[id] ?? 0])),
  });
}
