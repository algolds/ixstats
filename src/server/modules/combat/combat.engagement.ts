/**
 * An engagement's setup from the two nations' defense on their realm clocks: each side's branches and multipliers
 * from the defense model's derived view (`syncDefense`), the theatre from the map, and surprise from the defender's
 * alert in effect and the attacker's signals. Both nations must be in the same realm.
 */
import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_COMMITMENT,
  MAX_ENGAGEMENT_DAYS,
  MIN_COMMITMENT,
  attackerSignalsIntent,
  surpriseLevel,
  type CombatSide,
  type EngagementMode,
  type EngagementSetup,
} from "~/lib/military/combat";
import { syncDefense, type DefenseSnapshot } from "~/server/modules/defense";
import { assertRealmsMatch } from "~/server/shared/same-realm-guard";
import { loadTheatre } from "./combat.theatre";

/** One side as combat reads it from the defense model. */
export function combatSide(snapshot: DefenseSnapshot): CombatSide {
  return {
    countryId: snapshot.country.id,
    branches: snapshot.view.branches.map((b) => ({
      id: b.id,
      domain: b.domain,
      combatPower: b.combatPower,
      personnel: b.personnel,
      capital: b.capital,
    })),
    cev: snapshot.view.cev,
    readiness: snapshot.view.readiness,
    doctrine: snapshot.state.policy.doctrine,
    alert: snapshot.view.alert,
    maintenanceFunding: snapshot.view.funding.maintenanceFunding,
    infrastructureStock: snapshot.state.policy.infrastructureStock,
    gdp: snapshot.econ.gdp,
  };
}

/** The orders an engagement is committed with (hashed into the seed). */
export interface EngagementOrders {
  mode: EngagementMode;
  attackerId: string;
  defenderId: string;
  commitment: number;
  days: number;
  [key: string]: string | number | boolean | null;
}

export function normaliseOrders(input: {
  mode: EngagementMode;
  attackerId: string;
  defenderId: string;
  commitment?: number | null;
  days: number;
}): EngagementOrders {
  return {
    mode: input.mode,
    attackerId: input.attackerId,
    defenderId: input.defenderId,
    commitment: Math.round(Math.min(1, Math.max(MIN_COMMITMENT, input.commitment ?? DEFAULT_COMMITMENT)) * 100) / 100,
    days: Math.min(MAX_ENGAGEMENT_DAYS, Math.max(1, Math.round(input.days))),
  };
}

export interface Engagement {
  setup: EngagementSetup;
  attacker: DefenseSnapshot;
  defender: DefenseSnapshot;
}

/** Both sides brought up to date on their realm clocks, the theatre, and surprise, for the orders. */
export async function buildEngagement(db: PrismaClient, orders: EngagementOrders): Promise<Engagement> {
  const [attacker, defender] = await Promise.all([
    syncDefense(db, orders.attackerId),
    syncDefense(db, orders.defenderId),
  ]);
  assertRealmsMatch(attacker.country.realmId, defender.country.realmId);
  const theatre = await loadTheatre(db, attacker.country, defender.country);
  const policy = attacker.state.policy;
  const surprise = surpriseLevel({
    mode: orders.mode,
    defenderAlert: defender.view.alert,
    attackerSignals: attackerSignalsIntent({
      ...policy,
      mobilisationOrdered: attacker.state.branches.some((b) => b.mobilisationOrder > 0),
      nowClockMs: attacker.nowClockMs,
    }),
  });
  return {
    attacker,
    defender,
    setup: {
      mode: orders.mode,
      attacker: combatSide(attacker),
      defender: combatSide(defender),
      theatre,
      commitment: orders.commitment,
      days: orders.days,
      surprise,
    },
  };
}
