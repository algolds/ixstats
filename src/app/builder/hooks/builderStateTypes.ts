import type { BuilderStep } from "../components/enhanced/builderConfig";
import type { RealCountryData, EconomicInputs } from "../lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { ComponentType } from "~/lib/enums";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { GovernmentBuilderState } from "~/types/government";
import { registerCustomCurrency } from "~/lib/utils";
import { safeGetItemSync } from "~/lib/system/local-storage-mutex";

/**
 * Complete state structure for the country builder workflow.
 * Tracks progress through all builder steps and maintains data integrity.
 */
export interface BuilderState {
  /** How this country build was initiated ('scratch' | 'import' | 'template') */
  creationOrigin?: "scratch" | "import" | "template";
  /** Current active step in the builder workflow */
  step: BuilderStep;
  /** Foundation country selected as starting point (optional) */
  selectedCountry: RealCountryData | null;
  /** Selected Faction Archetype key/id (optional) */
  selectedArchetypeId: string | null;
  /** All economic indicators and metrics for the country */
  economicInputs: EconomicInputs | null;
  /** Selected atomic government components */
  governmentComponents: ComponentType[];
  /** Tax system configuration and brackets */
  taxSystemData: TaxBuilderState | null;
  /** Traditional government builder structure */
  governmentStructure: GovernmentBuilderState | null;
  /** Steps that have been completed by the user */
  completedSteps: BuilderStep[];
  /** Active tab within the Core step */
  activeCoreTab: string;
  /** Active sub-tab within the National Identity section */
  activeIdentitySubTab?: string;
  /** Active tab within the Government step */
  activeGovernmentTab: string;
  /** Active tab within the Economics step */
  activeEconomicsTab: string;
  /** Whether advanced mode is enabled for power users */
  showAdvancedMode: boolean;
  /** Persisted state for the economy builder wizard */
  economyBuilderState: EconomyBuilderState | null;
}

/**
 * Return value interface for useBuilderState hook.
 * Provides state access and update methods with auto-save capabilities.
 */
export interface UseBuilderStateReturn {
  /** Complete builder state object */
  builderState: BuilderState;
  /** Direct state setter (use sparingly, prefer typed update methods) */
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  /** Timestamp of last successful auto-save */
  lastSaved: Date | null;
  /** Whether an auto-save operation is currently in progress */
  isAutoSaving: boolean;
  /** Whether existing country data is loading (edit mode) */
  isLoadingCountry: boolean;
  /** Country ID for edit mode */
  countryId?: string;
  /** Builder mode: 'create' for new countries, 'edit' for existing */
  mode: "create" | "edit";
  /** Enabled steps for the current mode */
  enabledSteps: BuilderStep[];
  /** Whether a DB sync is active */
  isSyncing: boolean;
  /** Sync error if DB sync failed */
  syncError: Error | null;
  /** Selected archetype ID */
  selectedArchetypeId?: string | null;
  /** Update selected archetype ID */
  updateArchetypeId: (id: string | null) => void;
  /** Update economic inputs with type safety */
  updateEconomicInputs: (inputs: EconomicInputs) => void;
  /** Update selected government components */
  updateGovernmentComponents: (components: ComponentType[]) => void;
  /** Update government structure from traditional builder */
  updateGovernmentStructure: (structure: GovernmentBuilderState) => void;
  /** Update tax system configuration */
  updateTaxSystem: (taxData: TaxBuilderState) => void;
  /** Update economy builder state configuration */
  updateEconomyBuilderState: (economyState: EconomyBuilderState | null) => void;
  /** Update current step and mark as completed */
  updateStep: (
    step: BuilderStep,
    data?: Partial<BuilderState> | EconomicInputs | RealCountryData | ComponentType[]
  ) => void;
  /** Clear all draft data from localStorage */
  clearDraft: () => void;
  /** Apply complete imported nation data into builder state */
  applyImportedData: (data: Partial<BuilderState>) => void;
  /** Check if a step can be accessed (based on completion) */
  canAccessStep: (step: BuilderStep) => boolean;
  /** Manually trigger save to localStorage and database sync */
  triggerManualSave: () => Promise<void>;
  /** Whether a draft or saved state was restored on mount */
  hasRestoredState: boolean;
}

export const baseInitialState: BuilderState = {
  step: "foundation",
  selectedCountry: null,
  selectedArchetypeId: null,
  economicInputs: null,
  governmentComponents: [],
  taxSystemData: null,
  governmentStructure: {
    structure: {
      governmentName: "Government of the Nation",
      governmentType: "Other",
      headOfState: "",
      headOfGovernment: "",
      legislatureName: "",
      executiveName: "",
      judicialName: "",
      totalBudget: 350000000,
      fiscalYear: "Calendar Year",
      budgetCurrency: "USD",
    },
    departments: [],
    budgetAllocations: [],
    revenueSources: [],
    isValid: true,
    errors: { structure: [], departments: {}, budget: [], revenue: [] },
  },
  completedSteps: [],
  activeCoreTab: "identity",
  activeIdentitySubTab: "archetype",
  activeGovernmentTab: "components",
  activeEconomicsTab: "components",
  showAdvancedMode: false,
  economyBuilderState: null,
};

export const getInitialState = (mode: "create" | "edit" = "create"): BuilderState => {
  const isAdvancedInitial =
    typeof window !== "undefined"
      ? safeGetItemSync("ixstates:builder-advanced-mode") === "advanced" ||
        safeGetItemSync("editor-mode") === "expert"
      : false;

  if (mode === "edit") {
    return {
      ...baseInitialState,
      step: "core",
      completedSteps: ["foundation"],
      activeCoreTab: "identity",
      activeIdentitySubTab: "basic",
      showAdvancedMode: true,
    };
  }

  return { ...baseInitialState, showAdvancedMode: isAdvancedInitial };
};

export function sanitizeEconomicInputs<T extends Partial<EconomicInputs> | null | undefined>(
  inputs: T
): T {
  if (!inputs) return inputs;
  const clean = { ...inputs };
  if (clean.nationalIdentity?.currency) {
    registerCustomCurrency(
      clean.nationalIdentity.currency,
      clean.nationalIdentity.currencySymbol || "$"
    );
  }
  if (clean.laborEmployment) {
    clean.laborEmployment = { ...clean.laborEmployment };
    const toBoundedPercent = (value: number | string | null | undefined, fallback: number) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.min(100, n));
    };
    clean.laborEmployment.laborForceParticipationRate = toBoundedPercent(
      clean.laborEmployment.laborForceParticipationRate,
      65
    );
    clean.laborEmployment.unemploymentRate = toBoundedPercent(
      clean.laborEmployment.unemploymentRate,
      5
    );
    if (
      clean.laborEmployment.employmentRate !== null &&
      clean.laborEmployment.employmentRate !== undefined
    ) {
      clean.laborEmployment.employmentRate = toBoundedPercent(
        clean.laborEmployment.employmentRate,
        95
      );
    }
  }
  if (clean.demographics) {
    clean.demographics = { ...clean.demographics };
    if (
      clean.demographics.lifeExpectancy === null ||
      clean.demographics.lifeExpectancy === undefined
    ) {
      clean.demographics.lifeExpectancy = 70;
    }
    if (clean.demographics.literacyRate === null || clean.demographics.literacyRate === undefined) {
      clean.demographics.literacyRate = 90;
    }
    if (clean.demographics.urbanRuralSplit) {
      const u = clean.demographics.urbanRuralSplit.urban;
      const r = clean.demographics.urbanRuralSplit.rural;
      clean.demographics.urbanRuralSplit = {
        urban: u === null || u === undefined || isNaN(Number(u)) ? 65 : Number(u),
        rural: r === null || r === undefined || isNaN(Number(r)) ? 35 : Number(r),
      };
    } else {
      clean.demographics.urbanRuralSplit = { urban: 65, rural: 35 };
    }
  }
  return clean as T;
}
