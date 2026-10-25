/**
 * NPC defense (owner decision: NPC forces derive from their economy). An NPC's budget runs the same fallback chain
 * as a player's, its government form's default Defense share scaled by a regional factor; its forces come from the
 * same formulas (`starterNation`) and are stored like a player's. D3 adds the damped Richardson response to threats
 * through `threatBurdenAdjustment`.
 */
import { departmentsForForm } from "~/lib/government/form-departments";
import { matchGovernmentForm, type GovernmentFormId } from "~/lib/government/forms";
import { SHARE_PRESETS, type Doctrine } from "./constants";
import type { PolicyState } from "./types";

/** Regional factor on an NPC's Defense share (designer hook; no region data sets one yet). */
export const NPC_REGION_DEFENSE_MULTIPLIER: Readonly<Record<string, number>> = {};

/** A government form's default Defense share of spending (all its Defense-category departments). */
export function formDefenseShare(formId: string): number {
  return departmentsForForm(formId)
    .filter((d) => d.category === "Defense")
    .reduce((sum, d) => sum + d.spendingShare, 0);
}

/** The form a free-text government type reads as (wiki infobox values, NPC rows). */
export const governmentFormOf = (governmentType: string | null | undefined): GovernmentFormId =>
  matchGovernmentForm(governmentType ?? "");

/** An NPC's Defense share of spending: the form's default × its region's factor. */
export function npcDefenseShare(input: {
  governmentType: string | null | undefined;
  region: string | null | undefined;
}): number {
  const regional = NPC_REGION_DEFENSE_MULTIPLIER[input.region ?? ""] ?? 1;
  return formDefenseShare(governmentFormOf(input.governmentType)) * regional;
}

/**
 * D3's hook: the Richardson step's change in burden (share of GDP) an NPC's threats call for. 0 until D3 lands:
 *   Δm = 0.10 × Σ Threat − 0.25 × (m − m_base) + grievance
 */
export function threatBurdenAdjustment(_countryId: string): number {
  return 0;
}

/** Manpower and doctrine an NPC's government form favours (designer). */
const NPC_MANPOWER: Partial<Record<GovernmentFormId, { volunteerShare: number; doctrine: Doctrine }>> =
  {
    "military-government": { volunteerShare: 0.3, doctrine: "expeditionary" },
    "one-party-state": { volunteerShare: 0.4, doctrine: "balanced" },
    "absolute-monarchy": { volunteerShare: 0.6, doctrine: "balanced" },
    theocracy: { volunteerShare: 0.6, doctrine: "defensive" },
    confederation: { volunteerShare: 0.5, doctrine: "defensive" },
  };

/** An NPC's policy: the form's manpower model and doctrine; the conscript-heavy ones take the territorial split. */
export function npcPolicy(governmentType: string | null | undefined): Partial<PolicyState> {
  const manpower = NPC_MANPOWER[governmentFormOf(governmentType)];
  if (!manpower) return {};
  return manpower.volunteerShare < 0.5
    ? {
        ...manpower,
        shares: { ...SHARE_PRESETS.territorial },
      }
    : manpower;
}
