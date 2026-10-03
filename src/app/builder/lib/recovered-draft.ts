/**
 * The country editor's local crash-recovery copy.
 *
 * Edit mode autosaves to the server a moment after each change and keeps a
 * local copy of the state (`builder_state_<countryId>`). If the tab closed
 * before a save reached the server, or the save failed, the local copy is newer
 * than the country. The editor then offers to restore it; restoring applies it
 * on top of the loaded country, so the restored fields count as changes and
 * autosave sends them.
 */

import { safeGetItemSync, safeRemoveItemSync } from "~/lib/system/local-storage-mutex";
import type { BuilderState } from "../hooks/builderStateTypes";
import { sanitizeEconomicInputs } from "../hooks/builderStateTypes";
import { createDefaultEconomicInputs } from "./default-economic-inputs";
import type { EconomicInputs, NationalIdentityData } from "~/types/builder";

export interface RecoveredDraft {
  state: BuilderState;
  savedAt: Date;
}

const draftStorageKeys = (countryId: string) => ({
  state: `builder_state_${countryId}`,
  savedAt: `builder_last_saved_${countryId}`,
});

/** The stored local copy for a country, or null when there is none or it is unreadable. */
export function readStoredDraft(countryId: string): RecoveredDraft | null {
  const keys = draftStorageKeys(countryId);
  const raw = safeGetItemSync(keys.state);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as BuilderState;
    const savedAtRaw = safeGetItemSync(keys.savedAt);
    const savedAt = savedAtRaw ? new Date(savedAtRaw) : new Date(0);
    if (Number.isNaN(savedAt.getTime())) return null;
    if (!state?.economicInputs?.countryName) return null;
    return { state, savedAt };
  } catch {
    return null;
  }
}

export function removeStoredDraft(countryId: string): void {
  const keys = draftStorageKeys(countryId);
  safeRemoveItemSync(keys.state);
  safeRemoveItemSync(keys.savedAt);
}

/** Identity text fields that keep the loaded value when the draft left them blank. */
const IDENTITY_TEXT_DEFAULTS = {
  officialName: "",
  governmentType: "Republic",
  motto: "",
  mottoNative: "",
  capitalCity: "",
  largestCity: "",
  demonym: "",
  currency: "USD",
  officialLanguages: "",
  nationalLanguage: "",
  nationalAnthem: "",
  nationalDay: "",
  callingCode: "",
  internetTLD: "",
} as const satisfies Partial<Record<keyof NationalIdentityData, string>>;

const SECTION_KEYS = [
  "coreIndicators",
  "laborEmployment",
  "fiscalSystem",
  "incomeWealth",
  "governmentSpending",
  "demographics",
] as const;

/**
 * Applies a recovered draft on top of the loaded country. Saved fields come
 * from the draft; identity fields the draft left blank keep the loaded value.
 * Navigation state (step, tabs, view mode) stays as it is.
 */
export function mergeRecoveredDraft(prev: BuilderState, draft: BuilderState): BuilderState {
  const saved = sanitizeEconomicInputs(draft.economicInputs);
  if (!saved) return prev;

  const base: EconomicInputs = prev.economicInputs ?? createDefaultEconomicInputs();
  const baseIdentity = base.nationalIdentity;
  const savedIdentity = saved.nationalIdentity;

  const identityText = Object.fromEntries(
    Object.entries(IDENTITY_TEXT_DEFAULTS).map(([key, fallback]) => {
      const field = key as keyof typeof IDENTITY_TEXT_DEFAULTS;
      return [key, savedIdentity?.[field] || baseIdentity?.[field] || fallback];
    })
  ) as Record<keyof typeof IDENTITY_TEXT_DEFAULTS, string>;

  const mergedInputs: EconomicInputs = {
    ...base,
    ...saved,
    ...Object.fromEntries(SECTION_KEYS.map((key) => [key, saved[key] || base[key]])),
    countryName: saved.countryName || base.countryName || "",
    flagUrl: saved.flagUrl || base.flagUrl || "",
    coatOfArmsUrl: saved.coatOfArmsUrl || base.coatOfArmsUrl || "",
    nationalIdentity: {
      ...baseIdentity,
      ...savedIdentity,
      ...identityText,
      countryName:
        savedIdentity?.countryName || baseIdentity?.countryName || saved.countryName || "",
      drivingSide:
        (savedIdentity?.drivingSide ?? baseIdentity?.drivingSide) === "left" ? "left" : "right",
    },
  };

  return {
    ...prev,
    economicInputs: mergedInputs,
    governmentStructure: draft.governmentStructure || prev.governmentStructure,
    taxSystemData: draft.taxSystemData || prev.taxSystemData,
    governmentComponents: draft.governmentComponents || prev.governmentComponents,
    economyBuilderState: draft.economyBuilderState || prev.economyBuilderState,
  };
}
