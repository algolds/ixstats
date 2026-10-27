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
  normaliseEffort,
  npcPolicy,
  setEffortShare,
  starterBranchName,
  starterBranchSpecs,
  starterNation,
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

interface NewBranch {
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

/** The effort share a new branch of a domain asks for. */
const newBranchEffort = (input: NewBranch) =>
  input.effortShare ?? (DOMAIN_PARAMS[input.domain].starterEffort || 0.1);

const branchRow = (input: NewBranch, effortShare: number, lastTickClockMs: number) => ({
  countryId: input.countryId,
  domain: input.domain,
  name: input.name,
  ...input.identity,
  effortShare,
  readinessCondition: 1,
  lastTickClockMs,
});

/**
 * A new, empty branch (it grows from the budget on the realm clock). It takes its effort share and the other branches
 * keep theirs in proportion to the rest, so the shares still sum to 1.
 */
export async function createEmptyBranch(db: PrismaClient, input: NewBranch) {
  const snapshot = await syncDefense(db, input.countryId);
  const others = snapshot.state.branches;
  const efforts = setEffortShare(
    [...others.map((b) => b.effortShare), 0],
    others.length,
    newBranchEffort(input)
  );
  return db.$transaction(async (tx) => {
    for (const [i, branch] of others.entries()) {
      await tx.militaryBranch.update({ where: { id: branch.id }, data: { effortShare: efforts[i]! } });
    }
    return tx.militaryBranch.create({
      data: branchRow(input, efforts[others.length]!, snapshot.state.lastTickClockMs),
    });
  });
}

/** Delete a branch (units, assets and orders cascade); the remaining branches' shares are scaled back to sum 1. */
export async function deleteBranch(db: PrismaClient, input: { countryId: string; branchId: string }) {
  const remaining = await db.militaryBranch.findMany({
    where: { countryId: input.countryId, isActive: true, id: { not: input.branchId } },
    select: { id: true, effortShare: true },
    orderBy: { createdAt: "asc" },
  });
  const efforts = normaliseEffort(remaining.map((b) => b.effortShare));
  return db.$transaction(async (tx) => {
    await tx.militaryBranch.delete({ where: { id: input.branchId } });
    for (const [i, branch] of remaining.entries()) {
      await tx.militaryBranch.update({ where: { id: branch.id }, data: { effortShare: efforts[i]! } });
    }
    return { id: input.branchId };
  });
}

/**
 * The Defense page's "start from a starter force": a nation's forces exist from its first read, so this ensures them
 * and, when every branch was deleted, adds empty army, navy and air force branches with the starter split.
 */
export async function seedStarterBranches(db: PrismaClient, countryId: string) {
  const snapshot = await syncDefense(db, countryId);
  if (snapshot.state.branches.length > 0) {
    return { created: 0, budgetSource: snapshot.budgetSource };
  }
  const specs = starterBranchSpecs();
  const efforts = normaliseEffort(specs.map((spec) => spec.effortShare));
  for (const [i, spec] of specs.entries()) {
    const input = { countryId, domain: spec.domain, name: starterBranchName(spec.domain) };
    await db.militaryBranch.create({ data: branchRow(input, efforts[i]!, snapshot.state.lastTickClockMs) });
  }
  return { created: specs.length, budgetSource: snapshot.budgetSource };
}
