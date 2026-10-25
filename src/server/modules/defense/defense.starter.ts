/**
 * Starter forces for the Defense page: a preview of what the reset gives a nation (its budget's equilibrium), and
 * new branches. A nation gets its starter force once (`ensureStarterForce`, at the reset or on first touch); a branch
 * created later, or re-created after deleting them all, starts empty and grows from the budget, so deleting a worn
 * force never buys a fresh one.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  DOMAIN_PARAMS,
  deriveNation,
  npcPolicy,
  starterBranchName,
  starterNation,
  STARTER_DOMAINS,
  type BranchDomain,
} from "~/lib/military/model";
import { clockForCountry } from "~/server/shared/realm-time";
import { DEFENSE_COUNTRY_SELECT, loadEconomy } from "./defense.economy";
import { syncDefense } from "./defense.sync";

/** The starter force the nation's current budget would give it. */
export async function previewStarterForce(db: PrismaClient, countryId: string) {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: DEFENSE_COUNTRY_SELECT,
  });
  if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
  const clock = await clockForCountry(db, country);
  const now = clock.now();
  const { econ, budgetSource } = await loadEconomy(db, country, clock);
  const state = starterNation({
    econ,
    clockMs: now,
    policy: country.ownerUserId === null ? npcPolicy(country.governmentType) : {},
  });
  const view = deriveNation(state, econ, [], now);
  return {
    budget: econ.defenseBudget,
    budgetSource,
    combatPower: view.combatPower,
    readiness: view.readiness,
    cLevel: view.cLevel,
    branches: view.branches.map((b) => ({
      domain: b.domain,
      name: starterBranchName(b.domain),
      activeDuty: Math.round(b.active),
      reserves: Math.round(b.reserves),
      capital: b.capital,
      readiness: b.readiness,
      cLevel: b.cLevel,
    })),
  };
}

/** A new, empty branch (it grows from the budget on the realm clock). */
export async function createEmptyBranch(
  db: PrismaClient,
  input: {
    countryId: string;
    domain: BranchDomain;
    name: string;
    effortShare?: number;
    identity?: {
      motto?: string | null;
      description?: string | null;
      established?: string | null;
      imageUrl?: string | null;
      civilianStaff?: number;
    };
  }
) {
  const snapshot = await syncDefense(db, input.countryId);
  return db.militaryBranch.create({
    data: {
      countryId: input.countryId,
      domain: input.domain,
      name: input.name,
      ...input.identity,
      effortShare: input.effortShare ?? (DOMAIN_PARAMS[input.domain].starterEffort || 0.1),
      readinessCondition: 1,
      lastTickClockMs: snapshot.state.lastTickClockMs,
    },
  });
}

/**
 * The Defense page's "start from a starter force": a nation's forces exist from its first read, so this ensures them
 * and, when every branch was deleted, adds empty army, navy and air force branches.
 */
export async function seedStarterBranches(db: PrismaClient, countryId: string) {
  const snapshot = await syncDefense(db, countryId);
  if (snapshot.state.branches.length > 0) {
    return { created: 0, budgetSource: snapshot.budgetSource };
  }
  for (const domain of STARTER_DOMAINS) {
    await createEmptyBranch(db, { countryId, domain, name: starterBranchName(domain) });
  }
  return { created: STARTER_DOMAINS.length, budgetSource: snapshot.budgetSource };
}
