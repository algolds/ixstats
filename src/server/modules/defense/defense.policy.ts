/**
 * Policy writes (the four levers, research §7.8): budget split with presets, manpower model, doctrine and alert,
 * O&M priority, industrial surge and branch allocation. Every write first brings the nation up to date, so a change
 * applies from now on its realm clock and never rewrites months already ticked.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  effectiveAlert,
  normaliseShares,
  presetShares,
  type AlertLevel,
  type BudgetShares,
  type Doctrine,
  type OmPriority,
  type SharePreset,
} from "~/lib/military/model";
import { syncDefense } from "./defense.sync";

async function policyRow(db: PrismaClient, countryId: string) {
  const snapshot = await syncDefense(db, countryId);
  const policy = await db.defensePolicy.findUnique({ where: { countryId } });
  if (!policy) throw new TRPCError({ code: "NOT_FOUND", message: "Defense policy not found" });
  return { snapshot, policy };
}

/** Apply a preset, or set custom shares (scaled to sum to 1). */
export async function setDefenseShares(
  db: PrismaClient,
  input: { countryId: string; preset?: SharePreset; shares?: BudgetShares }
) {
  const { policy } = await policyRow(db, input.countryId);
  const shares = input.preset
    ? presetShares(input.preset)
    : input.shares
      ? normaliseShares(input.shares)
      : null;
  if (!shares) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a preset or set shares." });
  return db.defensePolicy.update({
    where: { id: policy.id },
    data: {
      sharePersonnel: shares.personnel,
      shareOm: shares.om,
      shareProcurement: shares.procurement,
      shareRd: shares.rd,
      shareInfrastructure: shares.infrastructure,
      preset: input.preset ?? null,
    },
  });
}

export async function setManpowerModel(
  db: PrismaClient,
  input: { countryId: string; volunteerShare: number; serviceMonths: number; reserveYears: number }
) {
  const { policy } = await policyRow(db, input.countryId);
  return db.defensePolicy.update({
    where: { id: policy.id },
    data: {
      volunteerShare: input.volunteerShare,
      serviceMonths: input.serviceMonths,
      reserveYears: input.reserveYears,
    },
  });
}

export async function setDoctrine(db: PrismaClient, input: { countryId: string; doctrine: Doctrine }) {
  const { policy } = await policyRow(db, input.countryId);
  return db.defensePolicy.update({ where: { id: policy.id }, data: { doctrine: input.doctrine } });
}

/**
 * Order an alert level. The level in effect now becomes the previous one, so a raise bites only after its days
 * (7 Elevated … 30 War) on the realm clock, and flipping back and forth never skips the wait.
 */
export async function setAlertLevel(
  db: PrismaClient,
  input: { countryId: string; alertLevel: AlertLevel }
) {
  const { policy, snapshot } = await policyRow(db, input.countryId);
  if (policy.alertLevel === input.alertLevel) return policy;
  const inEffect = effectiveAlert(policy, snapshot.nowClockMs);
  return db.defensePolicy.update({
    where: { id: policy.id },
    data: {
      alertLevel: input.alertLevel,
      previousAlertLevel: inEffect,
      alertChangedClockMs: snapshot.nowClockMs,
    },
  });
}

export async function setOmPriority(
  db: PrismaClient,
  input: { countryId: string; omPriority: OmPriority }
) {
  const { policy } = await policyRow(db, input.countryId);
  return db.defensePolicy.update({ where: { id: policy.id }, data: { omPriority: input.omPriority } });
}

/** Start or stop an industrial surge (capacity ramps to 2× over 24 months, +30% domestic cost while on). */
export async function setSurge(db: PrismaClient, input: { countryId: string; surging: boolean }) {
  const { policy, snapshot } = await policyRow(db, input.countryId);
  if ((policy.surgeStartedClockMs !== null) === input.surging) return policy;
  return db.defensePolicy.update({
    where: { id: policy.id },
    data: { surgeStartedClockMs: input.surging ? snapshot.nowClockMs : null },
  });
}

/** A branch's effort share and desired strength (null follows the budget). */
export async function setBranchAllocation(
  db: PrismaClient,
  input: { countryId: string; branchId: string; effortShare?: number; targetActive?: number | null }
) {
  const snapshot = await syncDefense(db, input.countryId);
  if (!snapshot.state.branches.some((b) => b.id === input.branchId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
  }
  return db.militaryBranch.update({
    where: { id: input.branchId },
    data: {
      ...(input.effortShare !== undefined ? { effortShare: input.effortShare } : {}),
      ...(input.targetActive !== undefined ? { targetActive: input.targetActive } : {}),
    },
  });
}
