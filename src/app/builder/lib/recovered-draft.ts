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
import type { EconomicInputs } from "~/types/builder";

export interface RecoveredDraft {
  state: BuilderState;
  savedAt: Date;
}

export const draftStorageKeys = (countryId: string) => ({
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

/**
 * Applies a recovered draft on top of the loaded country. Saved fields come
 * from the draft; identity fields the draft left blank keep the loaded value.
 * Navigation state (step, tabs, view mode) stays as it is.
 */
export function mergeRecoveredDraft(prev: BuilderState, draft: BuilderState): BuilderState {
  const sanitizedSaved = sanitizeEconomicInputs(draft.economicInputs);
  if (!sanitizedSaved) return prev;

  const baseInputs: EconomicInputs = prev.economicInputs ?? createDefaultEconomicInputs();
  const baseIdentity = baseInputs.nationalIdentity;
  const savedIdentity = sanitizedSaved.nationalIdentity;

  const mergedInputs: EconomicInputs = {
    ...baseInputs,
    ...sanitizedSaved,
    countryName: sanitizedSaved.countryName || baseInputs.countryName || "",
    flagUrl: sanitizedSaved.flagUrl || baseInputs.flagUrl || "",
    coatOfArmsUrl: sanitizedSaved.coatOfArmsUrl || baseInputs.coatOfArmsUrl || "",
    nationalIdentity: {
      ...baseIdentity,
      ...savedIdentity,
      countryName:
        savedIdentity?.countryName || baseIdentity?.countryName || sanitizedSaved.countryName || "",
      officialName: savedIdentity?.officialName || baseIdentity?.officialName || "",
      governmentType: savedIdentity?.governmentType || baseIdentity?.governmentType || "Republic",
      motto: savedIdentity?.motto || baseIdentity?.motto || "",
      mottoNative: savedIdentity?.mottoNative || baseIdentity?.mottoNative || "",
      capitalCity: savedIdentity?.capitalCity || baseIdentity?.capitalCity || "",
      largestCity: savedIdentity?.largestCity || baseIdentity?.largestCity || "",
      demonym: savedIdentity?.demonym || baseIdentity?.demonym || "",
      currency: savedIdentity?.currency || baseIdentity?.currency || "USD",
      officialLanguages: savedIdentity?.officialLanguages || baseIdentity?.officialLanguages || "",
      nationalLanguage: savedIdentity?.nationalLanguage || baseIdentity?.nationalLanguage || "",
      nationalAnthem: savedIdentity?.nationalAnthem || baseIdentity?.nationalAnthem || "",
      nationalDay: savedIdentity?.nationalDay || baseIdentity?.nationalDay || "",
      callingCode: savedIdentity?.callingCode || baseIdentity?.callingCode || "",
      internetTLD: savedIdentity?.internetTLD || baseIdentity?.internetTLD || "",
      drivingSide:
        (savedIdentity?.drivingSide ?? baseIdentity?.drivingSide) === "left" ? "left" : "right",
    },
    coreIndicators: sanitizedSaved.coreIndicators || baseInputs.coreIndicators,
    laborEmployment: sanitizedSaved.laborEmployment || baseInputs.laborEmployment,
    fiscalSystem: sanitizedSaved.fiscalSystem || baseInputs.fiscalSystem,
    incomeWealth: sanitizedSaved.incomeWealth || baseInputs.incomeWealth,
    governmentSpending: sanitizedSaved.governmentSpending || baseInputs.governmentSpending,
    demographics: sanitizedSaved.demographics || baseInputs.demographics,
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
