/**
 * Government Staffing Shortage (owner ruling 2026-10-28): the issue is raised when executive bandwidth is over
 * capacity, and each answer fixes that cause. "Expand the civil service" hires the shortfall (permanent capacity, a
 * little approval for the payroll); "Scale back programs" pauses the newest government components until their staff
 * covers the shortfall. Once the nation is back under capacity the issue stops; it returns only if it goes over again.
 */
import type { ComponentType, PrismaClient } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import type { ResponseOptionTemplate } from "./evaluators/issue-generator";
import type { ConsequenceDefinition } from "./types";

/** The consequence target the "Scale back programs" answer uses (handled by pauseComponentsForStaff). */
export const SCALE_BACK_TARGET = "GovernmentComponent";
const HIRING_APPROVAL_COST = 2;

/** Hiring comes in blocks of 10 bandwidth, enough to cover the shortfall. */
export const hiringFor = (shortfall: number) => Math.max(10, Math.ceil(shortfall / 10) * 10);

/** The two answers for a nation `shortfall` bandwidth over capacity. */
export function staffingShortageOptions(shortfall: number): ResponseOptionTemplate[] {
  const hire = hiringFor(shortfall);
  const hiring: ConsequenceDefinition = {
    targetModel: "GovernmentStructure",
    targetField: "civilServiceExpansion",
    operation: "add",
    value: hire,
  };
  const payroll: ConsequenceDefinition = {
    targetModel: "Country",
    targetField: "publicApproval",
    operation: "subtract",
    value: HIRING_APPROVAL_COST,
  };
  const scaleBack: ConsequenceDefinition = {
    targetModel: SCALE_BACK_TARGET,
    targetField: "staffRequired",
    operation: "subtract",
    value: Math.ceil(shortfall),
  };
  return [
    {
      id: "expand_civil_service",
      label: "Expand the civil service",
      description: `Hire civil servants for ${hire} more executive bandwidth, for good.`,
      consequences: [hiring, payroll],
      previewEffects: {
        economicImpact: "Higher payroll costs",
        stabilityImpact: `Executive bandwidth +${hire}, approval -${HIRING_APPROVAL_COST}`,
      },
      outcomeText: "New civil servants are recruited and the administrative backlog eases.",
      isAutoResolveDefault: true,
    },
    {
      id: "scale_back_programs",
      label: "Scale back programs",
      description:
        "Pause the newest government programs until their staff covers the shortfall. You can restore them in the editor.",
      consequences: [scaleBack],
      previewEffects: {
        economicImpact: "Reduced program coverage",
        stabilityImpact: `Frees at least ${Math.ceil(shortfall)} executive bandwidth`,
      },
      outcomeText: "Lower-priority programs are wound down until capacity is restored.",
    },
  ];
}

/**
 * Pauses (isActive = false) the most recently implemented active government components until their staff reaches
 * `needed`. Returns what was paused and how much staff that freed.
 */
export async function pauseComponentsForStaff(
  db: PrismaClient,
  countryId: string,
  needed: number
): Promise<{ paused: string[]; freed: number }> {
  const active = await db.governmentComponent.findMany({
    where: { countryId, isActive: true },
    orderBy: [{ implementationDate: "desc" }, { id: "desc" }],
    select: { id: true, componentType: true },
  });
  const paused: string[] = [];
  let freed = 0;
  for (const c of active) {
    if (freed >= needed) break;
    const staff = ATOMIC_COMPONENTS[c.componentType as ComponentType]?.metadata.staffRequired ?? 0;
    if (staff <= 0) continue;
    await db.governmentComponent.update({ where: { id: c.id }, data: { isActive: false } });
    paused.push(String(c.componentType));
    freed += staff;
  }
  return { paused, freed };
}
