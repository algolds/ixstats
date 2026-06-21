/**
 * Shared state management hook for the Atomic Country Builder.
 * Extracted from AtomicBuilderPage.tsx for modularity and reusability.
 *
 * This hook manages the complete builder workflow state including:
 * - Multi-step navigation (foundation, core, government, economics, preview)
 * - Country selection and economic data inputs
 * - Government components and structures
 * - Tax system configuration
 * - Auto-save functionality with localStorage persistence
 * - Cross-subsystem integration via UnifiedBuilderService
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { isEqual } from "lodash";
import { type BuilderStep, getStepsForMode } from "../components/enhanced/builderConfig";
import type { RealCountryData, EconomicInputs } from "../lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { ComponentType } from "~/lib/enums";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { safeGetItemSync, safeSetItemSync, safeRemoveItemSync } from "~/lib/localStorageMutex";
import { useNotify } from "~/hooks/useNotify";
import type {
  GovernmentDepartment,
  GovernmentBuilderState,
  GovernmentType,
  DepartmentInput,
} from "~/types/government";
import { createDefaultEconomicInputs } from "../lib/economy-data-service";
import type { CountryWithEditorFields } from "~/types/country-editor";
import { unifiedBuilderService } from "../services/UnifiedBuilderIntegrationService";
import { api } from "~/trpc/react";
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import { modernArchetypes } from "~/app/builder/data/archetypes/modern";
import { historicalArchetypes } from "~/app/builder/data/archetypes/historical";
import { mapLegacyGovernmentComponents } from "~/hooks/useArchetypes";
import { registerCustomCurrency } from "~/lib/format-utils";

const CURRENT_SCHEMA_VERSION = 1;

/** Parse numeric values like "$1.2 trillion", "€45,000", "10 million", "1234567" */
function parseWikiNumericValue(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.match(/([\d,\.]+)\s*(trillion|billion|million|thousand)?/i);
  if (!match) return null;
  let num = parseFloat(match[1]!.replace(/,/g, ""));
  if (isNaN(num)) return null;
  const mult = match[2]?.toLowerCase();
  if (mult === "trillion") num *= 1e12;
  else if (mult === "billion") num *= 1e9;
  else if (mult === "million") num *= 1e6;
  else if (mult === "thousand") num *= 1e3;
  return num > 0 ? num : null;
}

/** Normalize wiki government type to builder enum (Title Case, known types) */
function normalizeGovernmentType(raw: string): string {
  const normalized = raw.trim();
  const knownTypes = [
    "Constitutional Monarchy",
    "Federal Republic",
    "Parliamentary Democracy",
    "Presidential Republic",
    "Federal Constitutional Republic",
    "Unitary State",
    "Federation",
    "Confederation",
    "Empire",
    "City-State",
  ];
  for (const known of knownTypes) {
    if (normalized.toLowerCase() === known.toLowerCase()) return known;
  }
  // Title-case fallback for unknown types
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase()) || "Other";
}

/**
 * Complete state structure for the country builder workflow.
 * Tracks progress through all builder steps and maintains data integrity.
 */
export interface BuilderState {
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
  syncError: any;
  /** Selected archetype ID */
  selectedArchetypeId?: string | null;
  /** Update selected archetype ID */
  updateArchetypeId: (id: string | null) => void;
  /** Update economic inputs with type safety */
  updateEconomicInputs: (inputs: EconomicInputs) => void;
  /** Update selected government components */
  updateGovernmentComponents: (components: ComponentType[]) => void;
  /** Update government structure from traditional builder */
  updateGovernmentStructure: (structure: any) => void;
  /** Update tax system configuration */
  updateTaxSystem: (taxData: TaxBuilderState) => void;
  /** Update economy builder state configuration */
  updateEconomyBuilderState: (economyState: EconomyBuilderState | null) => void;
  /** Update current step and mark as completed */
  updateStep: (step: BuilderStep, data?: any) => void;
  /** Clear all draft data from localStorage */
  clearDraft: () => void;
  /** Check if a step can be accessed (based on completion) */
  canAccessStep: (step: BuilderStep) => boolean;
  /** Manually trigger save to localStorage and database sync */
  triggerManualSave: () => Promise<void>;
  /** Whether a draft or saved state was restored on mount */
  hasRestoredState: boolean;
}

const baseInitialState: BuilderState = {
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

const getInitialState = (mode: "create" | "edit" = "create"): BuilderState => {
  if (mode === "edit") {
    return {
      ...baseInitialState,
      step: "core",
      completedSteps: ["foundation"],
      activeCoreTab: "identity",
      activeIdentitySubTab: "basic",
    };
  }

  return { ...baseInitialState };
};

/**
 * Main builder state management hook for the Atomic Country Builder.
 *
 * Manages the complete workflow state for building a custom country, including:
 * - Multi-step navigation with progress tracking
 * - Automatic state persistence to localStorage
 * - Cross-subsystem integration (government, tax, economy)
 * - Quick-start workflow support
 * - Edit mode with existing country data loading
 * - Auto-save with debouncing (500ms delay)
 * - Page unload protection
 *
 * @hook
 * @param {('create'|'edit')} [mode='create'] - Builder mode (create new or edit existing)
 * @param {string} [countryId] - Country ID to load for edit mode
 * @returns {UseBuilderStateReturn} Builder state and update methods
 * @returns {BuilderState} returns.builderState - Current complete builder state
 * @returns {Function} returns.setBuilderState - Direct state setter (use typed methods when possible)
 * @returns {Date|null} returns.lastSaved - Timestamp of last successful save
 * @returns {boolean} returns.isAutoSaving - Whether save operation is in progress
 * @returns {boolean} returns.isLoadingCountry - Whether existing country data is loading
 * @returns {Function} returns.updateEconomicInputs - Update economic data with type safety
 * @returns {Function} returns.updateGovernmentComponents - Update selected atomic components
 * @returns {Function} returns.updateGovernmentStructure - Update traditional government builder
 * @returns {Function} returns.updateTaxSystem - Update tax system configuration
 * @returns {Function} returns.updateStep - Progress to next step with data
 * @returns {Function} returns.clearDraft - Clear all saved draft data
 * @returns {Function} returns.canAccessStep - Check if step is accessible
 *
 * @example
 * // Create mode (default)
 * function BuilderPage() {
 *   const { builderState, updateEconomicInputs, updateStep, lastSaved, isAutoSaving } = useBuilderState();
 *   const handleCoreComplete = (economicData: EconomicInputs) => {
 *     updateStep('core', economicData);
 *   };
 *   return <div><p>Step: {builderState.step}</p></div>;
 * }
 *
 * @example
 * // Edit mode with existing country
 * function CountryEditor({ countryId }: { countryId: string }) {
 *   const { builderState, isLoadingCountry, updateEconomicInputs } = useBuilderState('edit', countryId);
 *   if (isLoadingCountry) return <Loading />;
 *   return <div><p>Editing: {builderState.economicInputs?.countryName}</p></div>;
 * }
 *
 * @example
 * // Quick-start workflow (skipping foundation)
 * function QuickStartButton() {
 *   const { builderState, updateStep } = useBuilderState();
 *   const handleQuickStart = () => {
 *     localStorage.setItem('builder_quick_start_section', 'core');
 *   };
 *   return <button onClick={handleQuickStart}>Quick Start</button>;
 * }
 */
export function useBuilderState(
  mode: "create" | "edit" = "create",
  countryId?: string
): UseBuilderStateReturn {
  const notify = useNotify();
  const [builderState, setBuilderState] = useState<BuilderState>(() => getInitialState(mode));
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const quickStartProcessed = useRef(false);
  const editModeInitialized = useRef(false);
  // One-shot guard: the edit-mode localStorage restore must run only once.
  // Without it the effect re-runs whenever isLoadingCountry flips and merges
  // stale localStorage back over freshly-loaded DB data → edits "reset".
  const editRestoreDone = useRef(false);

  // Edit mode: Load existing country data
  const { data: existingCountry, isLoading: countryLoading } = api.countries.getByIdAtTime.useQuery(
    { id: countryId || "" },
    {
      enabled: mode === "edit" && !!countryId && countryId.trim() !== "",
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  const { data: existingGovernment, isLoading: governmentLoading } =
    api.government.getByCountryId.useQuery(
      { countryId: countryId || "" },
      {
        enabled: mode === "edit" && !!countryId,
        staleTime: 5 * 60 * 1000, // 5 minute cache
      }
    );

  const { data: existingTaxSystem, isLoading: taxSystemLoading } =
    api.taxSystem.getByCountryId.useQuery(
      { countryId: countryId || "" },
      {
        enabled: mode === "edit" && !!countryId,
        staleTime: 5 * 60 * 1000, // 5 minute cache
      }
    );

  // Relational subsystems not included in getByIdAtTime — needed so the editor
  // rehydrates ALL saved data (gov/economic atomic components, demographics
  // detail, income classes, spending categories) on re-entry.
  const { data: editorRelations, isLoading: relationsLoading } =
    api.countries.getEditorRelations.useQuery(
      { countryId: countryId || "" },
      {
        enabled: mode === "edit" && !!countryId,
        staleTime: 5 * 60 * 1000,
      }
    );

  const isLoadingCountry =
    mode === "edit" &&
    (countryLoading || governmentLoading || taxSystemLoading || relationsLoading);

  // Initialize edit mode with existing data
  useEffect(() => {
    if (mode === "edit" && existingCountry && !editModeInitialized.current && !isLoadingCountry) {
      editModeInitialized.current = true;

      const typedCountry = existingCountry as CountryWithEditorFields;
      const calculatedStats = typedCountry.calculatedStats;
      const currentPop =
        Number(calculatedStats?.currentPopulation) ||
        Number(typedCountry.baselinePopulation) ||
        10000000;
      const currentGdpPerCap =
        Number(calculatedStats?.currentGdpPerCapita) ||
        Number(typedCountry.baselineGdpPerCapita) ||
        25000;
      const currentTotalGdp =
        Number(calculatedStats?.currentTotalGdp) || currentPop * currentGdpPerCap;

      const inputs = createDefaultEconomicInputs({
        name: existingCountry.name,
        countryCode: (existingCountry as any).countryCode || "us",
        population: currentPop,
        gdpPerCapita: currentGdpPerCap,
        gdp: currentTotalGdp,
        unemploymentRate: typedCountry.unemploymentRate ?? 5,
        taxRevenuePercent: typedCountry.taxRevenueGDPPercent ?? 20,
      });

      // Populate with live country data
      inputs.countryName = existingCountry.name;

      inputs.coreIndicators = {
        totalPopulation: currentPop,
        gdpPerCapita: currentGdpPerCap,
        nominalGDP: currentTotalGdp,
        realGDPGrowthRate: typedCountry.realGDPGrowthRate ?? 0,
        inflationRate: typedCountry.inflationRate ?? 0,
        currencyExchangeRate: typedCountry.currencyExchangeRate ?? 1.0,
      };

      // Labor & Employment
      inputs.laborEmployment.unemploymentRate = typedCountry.unemploymentRate ?? 0;
      inputs.laborEmployment.laborForceParticipationRate =
        typedCountry.laborForceParticipationRate ?? 0;
      inputs.laborEmployment.employmentRate = typedCountry.employmentRate ?? 0;
      inputs.laborEmployment.totalWorkforce = typedCountry.totalWorkforce ?? 0;
      inputs.laborEmployment.averageWorkweekHours = typedCountry.averageWorkweekHours ?? 0;
      inputs.laborEmployment.minimumWage = typedCountry.minimumWage ?? 0;
      inputs.laborEmployment.averageAnnualIncome = typedCountry.averageAnnualIncome ?? 0;

      // Fiscal system
      inputs.fiscalSystem.taxRevenueGDPPercent = typedCountry.taxRevenueGDPPercent ?? 0;
      inputs.fiscalSystem.governmentRevenueTotal = typedCountry.governmentRevenueTotal ?? 0;
      inputs.fiscalSystem.totalDebtGDPRatio = typedCountry.totalDebtGDPRatio ?? 0;
      inputs.fiscalSystem.budgetDeficitSurplus = typedCountry.budgetDeficitSurplus ?? 0;
      inputs.fiscalSystem.governmentBudgetGDPPercent = typedCountry.governmentBudgetGDPPercent ?? 0;
      inputs.fiscalSystem.internalDebtGDPPercent = typedCountry.internalDebtGDPPercent ?? 0;
      inputs.fiscalSystem.externalDebtGDPPercent = typedCountry.externalDebtGDPPercent ?? 0;
      inputs.fiscalSystem.interestRates = typedCountry.interestRates ?? 0;
      inputs.fiscalSystem.debtServiceCosts = typedCountry.debtServiceCosts ?? 0;

      // Demographics
      inputs.demographics.lifeExpectancy = typedCountry.lifeExpectancy ?? 0;
      inputs.demographics.literacyRate = typedCountry.literacyRate ?? 0;
      const urbanPop = typedCountry.urbanPopulationPercent ?? 65;
      inputs.demographics.urbanRuralSplit = {
        urban: urbanPop,
        rural: 100 - urbanPop,
      };

      // Income & Wealth Distribution
      inputs.incomeWealth.povertyRate = typedCountry.povertyRate ?? 0;
      inputs.incomeWealth.incomeInequalityGini = typedCountry.incomeInequalityGini ?? 0;
      inputs.incomeWealth.socialMobilityIndex = typedCountry.socialMobilityIndex ?? 0;

      // Government Spending
      inputs.governmentSpending.totalSpending = typedCountry.totalGovernmentSpending ?? 0;
      inputs.governmentSpending.spendingGDPPercent = typedCountry.spendingGDPPercent ?? 0;
      inputs.governmentSpending.spendingPerCapita = typedCountry.spendingPerCapita ?? 0;
      inputs.governmentSpending.deficitSurplus = typedCountry.budgetDeficitSurplus ?? 0;

      // National Identity
      const nationalIdentity = typedCountry.nationalIdentity;
      inputs.nationalIdentity = {
        countryName: nationalIdentity?.countryName || existingCountry.name || "",
        officialName: nationalIdentity?.officialName || "",
        governmentType:
          nationalIdentity?.governmentType || existingCountry.governmentType || "republic",
        motto: nationalIdentity?.motto || "",
        mottoNative: nationalIdentity?.mottoNative || "",
        capitalCity: nationalIdentity?.capitalCity || "",
        largestCity: nationalIdentity?.largestCity || "",
        demonym: nationalIdentity?.demonym || "",
        currency: nationalIdentity?.currency || typedCountry.currencyName || "",
        currencySymbol: nationalIdentity?.currencySymbol || typedCountry.currencySymbol || "$",
        officialLanguages: nationalIdentity?.officialLanguages || "",
        nationalLanguage: nationalIdentity?.nationalLanguage || "",
        nationalAnthem: nationalIdentity?.nationalAnthem || "",
        nationalReligion: nationalIdentity?.nationalReligion || typedCountry.religion || "",
        nationalDay: nationalIdentity?.nationalDay || "",
        callingCode: nationalIdentity?.callingCode || "",
        internetTLD: nationalIdentity?.internetTLD || "",
        drivingSide: nationalIdentity?.drivingSide || "right",
        timeZone: nationalIdentity?.timeZone || "",
        isoCode: nationalIdentity?.isoCode || typedCountry.countryCode || "",
        coordinatesLatitude: nationalIdentity?.coordinatesLatitude || "",
        coordinatesLongitude: nationalIdentity?.coordinatesLongitude || "",
        emergencyNumber: nationalIdentity?.emergencyNumber || "",
        postalCodeFormat: nationalIdentity?.postalCodeFormat || "",
        nationalSport: nationalIdentity?.nationalSport || "",
        nationalAnimal: nationalIdentity?.nationalAnimal || "",
        nationalBird: nationalIdentity?.nationalBird || "",
        nationalFish: nationalIdentity?.nationalFish || "",
        founders: nationalIdentity?.founders || "",
        nationalFlower: nationalIdentity?.nationalFlower || "",
        nationalDish: nationalIdentity?.nationalDish || "",
        nationalFruit: nationalIdentity?.nationalFruit || "",
        nationalDrink: nationalIdentity?.nationalDrink || "",
        nationalInstrument: nationalIdentity?.nationalInstrument || "",
        nationalSymbol: nationalIdentity?.nationalSymbol || "",
        nationalAnimalImage: nationalIdentity?.nationalAnimalImage || "",
        nationalBirdImage: nationalIdentity?.nationalBirdImage || "",
        nationalFishImage: nationalIdentity?.nationalFishImage || "",
        foundersImage: nationalIdentity?.foundersImage || "",
        nationalFlowerImage: nationalIdentity?.nationalFlowerImage || "",
        nationalDishImage: nationalIdentity?.nationalDishImage || "",
        nationalFruitImage: nationalIdentity?.nationalFruitImage || "",
        nationalDrinkImage: nationalIdentity?.nationalDrinkImage || "",
        nationalInstrumentImage: nationalIdentity?.nationalInstrumentImage || "",
        nationalSymbolImage: nationalIdentity?.nationalSymbolImage || "",
        weekStartDay: nationalIdentity?.weekStartDay || "monday",
      };

      inputs.flagUrl = normalizeFlagUrl(nationalIdentity?.flagUrl || existingCountry.flag) || "";
      inputs.coatOfArmsUrl =
        normalizeFlagUrl(nationalIdentity?.coatOfArmsUrl || existingCountry.coatOfArms) || "";

      // Geography
      inputs.geography = {
        continent: existingCountry.continent || "",
        region: existingCountry.region || "",
      };

      // ── Hydrate relational subsystems (from getEditorRelations) ──────────
      // These are persisted by updateCountry but not returned by getByIdAtTime,
      // so without this the editor would show defaults on re-entry = "reset".
      const parseJsonArray = (v: unknown): any[] => {
        if (Array.isArray(v)) return v;
        if (typeof v === "string" && v.trim()) {
          try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const rel = editorRelations as any;
      if (rel?.demographics) {
        const ageDist = parseJsonArray(rel.demographics.ageDistribution);
        if (ageDist.length) inputs.demographics.ageDistribution = ageDist;
        const eduLevels = parseJsonArray(rel.demographics.educationLevels);
        if (eduLevels.length) (inputs.demographics as any).educationLevels = eduLevels;
        const regions = parseJsonArray(rel.demographics.regions);
        if (regions.length) (inputs.demographics as any).regions = regions;
      }
      if (rel?.incomeDistribution?.economicClasses) {
        const classes = parseJsonArray(rel.incomeDistribution.economicClasses);
        if (classes.length) (inputs.incomeWealth as any).economicClasses = classes;
      }
      if (rel?.governmentBudget?.spendingCategories) {
        const cats = parseJsonArray(rel.governmentBudget.spendingCategories);
        if (cats.length) (inputs.governmentSpending as any).spendingCategories = cats;
      }

      // Atomic government components (line was a TODO: [] — now actually loaded)
      const loadedGovernmentComponents: ComponentType[] = (rel?.governmentComponents || []).map(
        (c: any) => c.componentType as ComponentType
      );

      // Economy builder state: atomic economic components + persisted structure JSON
      let loadedEconomyBuilderState: EconomyBuilderState | null = null;
      const economicComps: any[] = rel?.economicComponents || [];
      let parsedStructure: any = null;
      if (rel?.economicProfile?.sectorBreakdown) {
        try {
          parsedStructure = JSON.parse(rel.economicProfile.sectorBreakdown);
        } catch {
          parsedStructure = null;
        }
      }
      if (economicComps.length > 0 || parsedStructure) {
        loadedEconomyBuilderState = {
          structure: parsedStructure || ({ sectors: [] } as any),
          sectors: parsedStructure?.sectors || [],
          laborMarket: {
            unemploymentRate: inputs.laborEmployment.unemploymentRate,
            participationRate: inputs.laborEmployment.laborForceParticipationRate,
          } as any,
          demographics: { totalPopulation: currentPop } as any,
          selectedAtomicComponents: economicComps.map((c: any) => c.componentType),
          isValid: true,
          errors: {} as any,
          lastUpdated: new Date(),
          version: "1.0.0",
        };
      }

      // Convert existing government to builder format
      let governmentStructure: GovernmentBuilderState | null = null;
      if (existingGovernment) {
        governmentStructure = {
          structure: {
            governmentName: existingGovernment.governmentName,
            governmentType: existingGovernment.governmentType as GovernmentType,
            headOfState: existingGovernment.headOfState ?? undefined,
            headOfGovernment: existingGovernment.headOfGovernment ?? undefined,
            legislatureName: existingGovernment.legislatureName ?? undefined,
            executiveName: existingGovernment.executiveName ?? undefined,
            judicialName: existingGovernment.judicialName ?? undefined,
            totalBudget: existingGovernment.totalBudget,
            fiscalYear: existingGovernment.fiscalYear,
            budgetCurrency: existingGovernment.budgetCurrency,
          },
          departments: (existingGovernment.departments as unknown as GovernmentDepartment[]).map(
            (dept) =>
              ({
                name: dept.name,
                shortName: dept.shortName ?? undefined,
                category: dept.category as any,
                description: dept.description ?? undefined,
                minister: dept.minister ?? undefined,
                ministerTitle: dept.ministerTitle || "",
                headquarters: dept.headquarters ?? undefined,
                established: dept.established ?? undefined,
                employeeCount: dept.employeeCount ?? undefined,
                icon: dept.icon ?? undefined,
                color: dept.color ?? undefined,
                priority: dept.priority ?? undefined,
                parentDepartmentId: dept.parentDepartmentId ?? undefined,
                organizationalLevel: (dept.organizationalLevel || "Department") as any,
                functions: (() => {
                  try {
                    return Array.isArray(dept.functions)
                      ? dept.functions
                      : typeof dept.functions === "string"
                        ? JSON.parse(dept.functions)
                        : [];
                  } catch (e) {
                    return [];
                  }
                })(),
                kpis: (() => {
                  try {
                    return Array.isArray(dept.kpis)
                      ? dept.kpis
                      : typeof dept.kpis === "string"
                        ? JSON.parse(dept.kpis)
                        : [];
                  } catch (e) {
                    return [];
                  }
                })(),
              }) as DepartmentInput
          ),
          budgetAllocations: existingGovernment.budgetAllocations.map((alloc: any) => ({
            departmentId: alloc.departmentId,
            budgetYear: alloc.budgetYear,
            allocatedAmount: alloc.allocatedAmount,
            allocatedPercent: alloc.allocatedPercent,
            notes: alloc.notes ?? undefined,
          })),
          revenueSources: existingGovernment.revenueSources.map((rev: any) => ({
            name: rev.name,
            category: rev.category as any,
            description: rev.description ?? undefined,
            rate: rev.rate ?? undefined,
            revenueAmount: rev.revenueAmount,
            revenuePercent: rev.revenuePercent ?? undefined,
            collectionMethod: rev.collectionMethod ?? undefined,
            administeredBy: rev.administeredBy ?? undefined,
          })),
          isValid: true,
          errors: { structure: [], departments: {}, budget: [], revenue: [] },
        };
      } else if (existingCountry) {
        governmentStructure = {
          structure: {
            governmentName: `Government of ${existingCountry.name}`,
            governmentType: (existingCountry.governmentType || "Other") as GovernmentType,
            headOfState: "",
            headOfGovernment: "",
            legislatureName: "",
            executiveName: "",
            judicialName: "",
            totalBudget: currentTotalGdp * 0.35,
            fiscalYear: "Calendar Year",
            budgetCurrency: typedCountry.currencyName || "USD",
          },
          departments: [],
          budgetAllocations: [],
          revenueSources: [],
          isValid: true,
          errors: { structure: [], departments: {}, budget: [], revenue: [] },
        };
      }

      // Convert existing tax system to builder format
      let taxSystemData = null;
      if (existingTaxSystem) {
        taxSystemData = existingTaxSystem as TaxBuilderState;
      }

      // Set initial state for edit mode
      setBuilderState({
        step: "core", // Skip foundation step in edit mode
        selectedCountry: null, // No foundation selection in edit mode
        selectedArchetypeId: null,
        economicInputs: inputs,
        governmentComponents: loadedGovernmentComponents,
        taxSystemData,
        governmentStructure,
        completedSteps: ["foundation"], // Auto-complete foundation step
        activeCoreTab: "identity",
        activeIdentitySubTab: "basic",
        activeGovernmentTab: "components",
        activeEconomicsTab: "components",
        showAdvancedMode: false,
        economyBuilderState: loadedEconomyBuilderState,
      });

      console.log(
        "[useBuilderState] Edit mode initialized with existing country data:",
        existingCountry.name
      );
    }
  }, [
    mode,
    existingCountry,
    existingGovernment,
    existingTaxSystem,
    editorRelations,
    isLoadingCountry,
  ]);

  // Load saved state on mount - runs AFTER initial database load
  useEffect(() => {
    // Skip quick-start and wiki import in edit mode, but still load saved edits.
    // Guarded to run ONCE — re-running clobbers fresh DB data with stale localStorage.
    if (
      mode === "edit" &&
      editModeInitialized.current &&
      !isLoadingCountry &&
      !editRestoreDone.current
    ) {
      editRestoreDone.current = true;
      try {
        const stateKey = `builder_state_${countryId}`;
        const savedKey = `builder_last_saved_${countryId}`;

        const savedState = safeGetItemSync(stateKey);
        const savedLastSaved = safeGetItemSync(savedKey);

        // localStorage is a crash-recovery buffer, NOT a co-equal source of truth.
        // Only let it override the freshly-loaded DB row when the local copy is
        // strictly newer than the DB's updatedAt (i.e. unsaved edits from a crash
        // or a sync that never completed). Otherwise the DB wins and we drop the
        // stale local copy so it can't resurrect old data over good server data.
        const localSavedAt = savedLastSaved ? new Date(savedLastSaved).getTime() : 0;
        const dbUpdatedAt = (existingCountry as any)?.updatedAt
          ? new Date((existingCountry as any).updatedAt).getTime()
          : 0;
        const localIsNewer = localSavedAt > dbUpdatedAt;

        if (savedState && !localIsNewer) {
          safeRemoveItemSync(stateKey);
          safeRemoveItemSync(savedKey);
          console.log("[useBuilderState] Discarded stale edit-mode localStorage (DB is newer)");
        } else if (savedState) {
          let parsedState;
          try {
            parsedState = JSON.parse(savedState);
          } catch {
            console.warn("[useBuilderState] Corrupted localStorage data for edit mode, discarding");
            return;
          }
          // Only restore if there's actual data and it's not just the initial empty state
          if (parsedState.economicInputs && parsedState.economicInputs.countryName) {
            setBuilderState((prev) => {
              // Deep merge economicInputs to preserve database-loaded data
              const sanitizedSaved = sanitizeEconomicInputs(parsedState.economicInputs);
              const mergedInputs = prev.economicInputs
                ? {
                    ...prev.economicInputs,
                    ...sanitizedSaved,
                    // Preserve database-loaded flag/COA if draft value is empty
                    flagUrl: sanitizedSaved.flagUrl || prev.economicInputs.flagUrl || "",
                    coatOfArmsUrl:
                      sanitizedSaved.coatOfArmsUrl || prev.economicInputs.coatOfArmsUrl || "",
                    // Ensure nationalIdentity is merged, not replaced
                    nationalIdentity: {
                      ...prev.economicInputs.nationalIdentity,
                      ...sanitizedSaved.nationalIdentity,
                    },
                  }
                : sanitizedSaved;

              return {
                ...prev,
                economicInputs: mergedInputs,
                governmentStructure: parsedState.governmentStructure || prev.governmentStructure,
                taxSystemData: parsedState.taxSystemData || prev.taxSystemData,
                governmentComponents: parsedState.governmentComponents || prev.governmentComponents,
                economyBuilderState: parsedState.economyBuilderState || prev.economyBuilderState,
                activeCoreTab: parsedState.activeCoreTab || prev.activeCoreTab,
                activeIdentitySubTab: "basic",
                activeGovernmentTab: parsedState.activeGovernmentTab || prev.activeGovernmentTab,
                activeEconomicsTab: parsedState.activeEconomicsTab || prev.activeEconomicsTab,
              };
            });
            setHasRestoredState(true);
            console.log("[useBuilderState] Restored saved edits from localStorage");

            const savedTab = parsedState.activeIdentitySubTab;
            if (savedTab && savedTab !== "archetype") {
              notify.info(
                "Session restored",
                `Starting at Archetype/Preset tab (was on "${savedTab}").`,
                { duration: 4000 }
              );
            }
          }
        }

        if (savedLastSaved) {
          setLastSaved(new Date(savedLastSaved));
        }
      } catch (error) {
        console.warn("[useBuilderState] Failed to restore saved edits:", error);
      }
    }

    // Create mode: handle quick-start, wiki import, and saved state
    if (mode === "create") {
      try {
        const quickStartSection = safeGetItemSync("builder_quick_start_section");

        if (quickStartSection === "core" && !quickStartProcessed.current) {
          quickStartProcessed.current = true;

          setBuilderState((prev) => ({
            ...prev,
            step: "core",
            selectedCountry: null,
            economicInputs: createDefaultEconomicInputs(),
            completedSteps: [...new Set([...prev.completedSteps, "foundation" as BuilderStep])],
          }));
          safeRemoveItemSync("builder_quick_start_section");
          return;
        }

        // Check for wiki import data
        const importedData = safeGetItemSync("builder_imported_data");
        if (importedData && !quickStartProcessed.current) {
          quickStartProcessed.current = true;

          try {
            const wikiData = JSON.parse(importedData);

            // Create default inputs and populate with wiki data
            const inputs = createDefaultEconomicInputs();

            // Map wiki data to economic inputs
            if (wikiData.name) inputs.countryName = wikiData.name;

            // Core indicators — check all field variants from unified-wiki-parser
            const popValue =
              wikiData.population ?? wikiData.population_estimate ?? wikiData.population_census;
            if (popValue) {
              const parsed = parseWikiNumericValue(popValue);
              if (parsed !== null) {
                inputs.coreIndicators.totalPopulation = parsed;
              }
            }

            const gdpPcValue =
              wikiData.gdpPerCapita ??
              wikiData.GDP_nominal_per_capita ??
              wikiData.GDP_PPP_per_capita;
            if (gdpPcValue) {
              const parsed = parseWikiNumericValue(gdpPcValue);
              if (parsed !== null) {
                inputs.coreIndicators.gdpPerCapita = parsed;
              }
            }

            // Nominal GDP: prefer explicit numeric field, fall back to string parsing, then derive
            const gdpNomValue =
              wikiData.gdp_nominal ?? wikiData.GDP_nominal ?? wikiData.gdp_ppp ?? wikiData.GDP_PPP;
            if (gdpNomValue !== undefined && gdpNomValue !== null) {
              const parsed = parseWikiNumericValue(gdpNomValue);
              if (parsed !== null) {
                inputs.coreIndicators.nominalGDP = parsed;
              }
            }
            if (
              !inputs.coreIndicators.nominalGDP &&
              inputs.coreIndicators.totalPopulation &&
              inputs.coreIndicators.gdpPerCapita
            ) {
              inputs.coreIndicators.nominalGDP =
                inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita;
            }

            // National identity (ensure object exists)
            if (!inputs.nationalIdentity) {
              inputs.nationalIdentity = {
                countryName: "",
                officialName: "",
                governmentType: "republic",
                motto: "",
                mottoNative: "",
                capitalCity: "",
                largestCity: "",
                demonym: "",
                currency: "",
                officialLanguages: "",
                nationalLanguage: "",
                nationalAnthem: "",
                nationalReligion: "", // Added to interface if not present
                nationalDay: "",
                callingCode: "",
                internetTLD: "",
                drivingSide: "right",
                timeZone: "",
                isoCode: "",
                currencySymbol: "",
                coordinatesLatitude: "",
                coordinatesLongitude: "",
              };
            }

            if (wikiData.name) inputs.nationalIdentity.countryName = wikiData.name;
            if (wikiData.official_name || wikiData.conventional_long_name) {
              inputs.nationalIdentity.officialName =
                wikiData.official_name || wikiData.conventional_long_name;
            }
            if (wikiData.government_type)
              inputs.nationalIdentity.governmentType = normalizeGovernmentType(
                wikiData.government_type
              );
            if (wikiData.motto || wikiData.national_motto)
              inputs.nationalIdentity.motto = wikiData.motto || wikiData.national_motto;
            if (wikiData.demonym) inputs.nationalIdentity.demonym = wikiData.demonym;
            if (wikiData.national_anthem)
              inputs.nationalIdentity.nationalAnthem = wikiData.national_anthem;
            if (wikiData.religion) inputs.nationalIdentity.nationalReligion = wikiData.religion;
            if (wikiData.capital) inputs.nationalIdentity.capitalCity = wikiData.capital;
            if (wikiData.largest_city) inputs.nationalIdentity.largestCity = wikiData.largest_city;
            if (wikiData.currency) inputs.nationalIdentity.currency = wikiData.currency;
            if (wikiData.currency_code)
              inputs.nationalIdentity.currencySymbol = wikiData.currency_code;
            if (wikiData.languages) inputs.nationalIdentity.officialLanguages = wikiData.languages;
            if (wikiData.calling_code) inputs.nationalIdentity.callingCode = wikiData.calling_code;
            if (wikiData.internet_tld) inputs.nationalIdentity.internetTLD = wikiData.internet_tld;
            if (wikiData.time_zone) inputs.nationalIdentity.timeZone = wikiData.time_zone;
            if (wikiData.iso_code) inputs.nationalIdentity.isoCode = wikiData.iso_code;
            if (wikiData.drives_on)
              inputs.nationalIdentity.drivingSide = wikiData.drives_on
                .toLowerCase()
                .includes("left")
                ? "left"
                : "right";

            // Coordinates
            if (wikiData.coordinates) {
              // Very rough parsing of coordinates string for placeholder
              const coords = wikiData.coordinates.toString();
              if (coords.includes("N") || coords.includes("S")) {
                inputs.nationalIdentity.coordinatesLatitude = coords.split(",")[0] || coords;
                inputs.nationalIdentity.coordinatesLongitude = coords.split(",")[1] || "";
              }
            }

            // Media
            if (wikiData.flagUrl) inputs.flagUrl = normalizeFlagUrl(wikiData.flagUrl) || "";
            if (wikiData.coatOfArmsUrl || wikiData.coat_of_arms)
              inputs.coatOfArmsUrl =
                normalizeFlagUrl(wikiData.coatOfArmsUrl || wikiData.coat_of_arms) || "";

            // Recalculate workforce size, wages, and fiscal metrics based on parsed population and gdp
            if (inputs.coreIndicators.totalPopulation) {
              const participation = inputs.laborEmployment.laborForceParticipationRate || 65;
              inputs.laborEmployment.totalWorkforce = Math.round(
                inputs.coreIndicators.totalPopulation * (participation / 100)
              );
            }
            if (inputs.coreIndicators.gdpPerCapita) {
              inputs.laborEmployment.minimumWage = Math.round(
                inputs.coreIndicators.gdpPerCapita * 0.02
              );
              inputs.laborEmployment.averageAnnualIncome = Math.round(
                inputs.coreIndicators.gdpPerCapita * 0.8
              );
            }
            const basePopulation = inputs.coreIndicators.totalPopulation;
            const baseNominalGDP = inputs.coreIndicators.nominalGDP;
            const baseTaxRevenuePercent = inputs.fiscalSystem.taxRevenueGDPPercent || 20;
            if (baseNominalGDP) {
              inputs.fiscalSystem.governmentRevenueTotal =
                (baseNominalGDP * baseTaxRevenuePercent) / 100;
              if (basePopulation) {
                inputs.fiscalSystem.taxRevenuePerCapita =
                  (baseNominalGDP * baseTaxRevenuePercent) / (100 * basePopulation);
              }
            }

            // Prepare builder state update
            const stateUpdate: Partial<typeof builderState> = {
              step: "core",
              economicInputs: inputs,
              completedSteps: ["foundation"],
            };

            // Government Structure Pre-population
            if (wikiData.government_type || wikiData.head_of_state) {
              const govType = (
                wikiData.government_type
                  ? normalizeGovernmentType(wikiData.government_type)
                  : "Other"
              ) as GovernmentType;
              stateUpdate.governmentStructure = {
                structure: {
                  governmentName: `Government of ${wikiData.name || "the Nation"}`,
                  governmentType: govType,
                  headOfState: wikiData.head_of_state || "",
                  headOfGovernment: wikiData.head_of_government || "",
                  legislatureName: wikiData.legislature || wikiData.upper_house || "",
                  executiveName: "",
                  judicialName: "",
                  totalBudget: (inputs.coreIndicators.nominalGDP || 1000000000) * 0.35,
                  fiscalYear: "Calendar Year",
                  budgetCurrency: wikiData.currency || wikiData.currency_code || "USD",
                },
                departments: [],
                budgetAllocations: [],
                revenueSources: [],
                isValid: false,
                errors: {},
              };
            }

            // Economy Builder State Pre-population
            const economyPop = popValue ? parseWikiNumericValue(popValue) : null;
            const economyGdp = gdpNomValue ? parseWikiNumericValue(gdpNomValue) : null;
            if (economyPop || economyGdp) {
              const totalPop = economyPop ?? 10000000;
              const totalGdp =
                economyGdp ??
                (inputs.coreIndicators.totalPopulation && inputs.coreIndicators.gdpPerCapita
                  ? inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita
                  : 1000000000);
              const gdpPerCapCalc = totalPop > 0 ? totalGdp / totalPop : 25000;
              const economicTier =
                gdpPerCapCalc > 50000
                  ? "Advanced"
                  : gdpPerCapCalc > 20000
                    ? "Developed"
                    : gdpPerCapCalc > 5000
                      ? "Emerging"
                      : "Developing";
              const urbanization = wikiData.urbanization
                ? parseWikiNumericValue(String(wikiData.urbanization))
                : null;
              const lifeExp = wikiData.life_expectancy
                ? parseWikiNumericValue(String(wikiData.life_expectancy))
                : null;
              const literacy = wikiData.literacy_rate
                ? parseWikiNumericValue(String(wikiData.literacy_rate))
                : null;

              stateUpdate.economyBuilderState = {
                structure: {
                  economicModel: "Mixed Economy",
                  primarySectors: [],
                  secondarySectors: [],
                  tertiarySectors: [],
                  totalGDP: totalGdp,
                  gdpCurrency: wikiData.currency_code || wikiData.currency || "USD",
                  economicTier,
                  growthStrategy: "Balanced",
                },
                sectors: [],
                laborMarket: {
                  totalWorkforce: Math.round(totalPop * 0.65 * 0.94),
                  laborForceParticipationRate: 65,
                  employmentRate: 94,
                  unemploymentRate: 6,
                  underemploymentRate: 8,
                  youthUnemploymentRate: 12,
                  seniorEmploymentRate: 35,
                  femaleParticipationRate: 50,
                  maleParticipationRate: 70,
                  sectorDistribution: {
                    agriculture: 5,
                    mining: 2,
                    manufacturing: 15,
                    construction: 8,
                    utilities: 2,
                    wholesale: 5,
                    retail: 10,
                    transportation: 5,
                    information: 3,
                    finance: 5,
                    professional: 10,
                    education: 6,
                    healthcare: 8,
                    hospitality: 5,
                    government: 8,
                    other: 3,
                  },
                  employmentType: {
                    fullTime: 70,
                    partTime: 15,
                    temporary: 8,
                    seasonal: 0,
                    selfEmployed: 5,
                    gig: 2,
                    informal: 0,
                  },
                  averageWorkweekHours: 40,
                  minimumWage: Math.max(gdpPerCapCalc * 0.08, 5),
                  averageWage: gdpPerCapCalc * 0.6,
                  medianWage: gdpPerCapCalc * 0.5,
                  wageGrowthRate: 2.5,
                  unionizationRate: 20,
                  collectiveBargainingCoverage: 25,
                  workersRights: "Moderate",
                  workplaceSafety: "Standard",
                  antiDiscriminationLaws: true,
                  equalPayLegislation: true,
                  parentalLeaveWeeks: 12,
                  paidVacationDays: 20,
                  sickLeaveDays: 10,
                  retirementAge: 65,
                  pensionSystem: "Mixed",
                  unemploymentBenefits: true,
                  jobTrainingPrograms: true,
                } as any,
                demographics: {
                  totalPopulation: totalPop,
                  populationGrowthRate: 1.0,
                  ageDistribution: {
                    under15: 20,
                    age15to64: 65,
                    over65: 15,
                  },
                  urbanRuralSplit: {
                    urban: urbanization ?? 75,
                    rural: 100 - (urbanization ?? 75),
                  },
                  regions: [],
                  lifeExpectancy: lifeExp ?? 72,
                  literacyRate: literacy ?? 90,
                  educationLevels: {
                    noEducation: 5,
                    primary: 20,
                    secondary: 50,
                    tertiary: 25,
                  },
                  netMigrationRate: 0,
                  immigrationRate: 3,
                  emigrationRate: 3,
                  infantMortalityRate: 5,
                  maternalMortalityRate: 10,
                  healthExpenditureGDP: 8,
                  youthDependencyRatio: 30,
                  elderlyDependencyRatio: 23,
                  totalDependencyRatio: 53,
                },
                selectedAtomicComponents: [],
                isValid: false,
                errors: {},
                lastUpdated: new Date(),
                version: "1.0.0",
              };
            }

            // Load selected components from wiki import
            if (wikiData._importResult?.selectedComponents?.length > 0) {
              stateUpdate.governmentComponents = wikiData._importResult.selectedComponents;
            }

            // Load parsed departments into government structure
            if (
              wikiData._importResult?.parsedDepartments?.length > 0 &&
              stateUpdate.governmentStructure
            ) {
              const deptInputs = wikiData._importResult.parsedDepartments.map((d: any) => ({
                name: d.name,
                category: d.category,
                description:
                  d.description || `Government ${d.category?.toLowerCase() || ""} department`,
                minister: d.minister,
                ministerTitle: "Minister",
                headquarters: "",
                established: "",
                employeeCount: 0,
                icon: "",
                color: "#6366f1",
                priority: 50,
                functions: [],
              }));
              stateUpdate.governmentStructure = {
                ...stateUpdate.governmentStructure,
                departments: deptInputs,
              };
            }

            // Set builder state with imported data
            setBuilderState((prev) => ({
              ...prev,
              ...stateUpdate,
            }));

            // Clean up imported data
            safeRemoveItemSync("builder_imported_data");

            console.log("[useBuilderState] Wiki import data loaded:", wikiData.name);
            return;
          } catch (parseError) {
            console.error("[useBuilderState] Failed to parse wiki import data:", parseError);
            // Continue to normal state loading
          }
        }

        if (!quickStartProcessed.current) {
          let savedState = safeGetItemSync("builder_state");
          let savedLastSaved = safeGetItemSync("builder_last_saved");

          // Fallback to sessionStorage if localStorage fails
          if (!savedState) {
            try {
              savedState = sessionStorage.getItem("builder_state");
              savedLastSaved = sessionStorage.getItem("builder_last_saved");
              if (savedState) {
                console.log("[BuilderState] Recovered state from sessionStorage");
              }
            } catch (error) {
              console.warn("[BuilderState] Failed to access sessionStorage:", error);
            }
          }

          if (savedState) {
            let parsedState;
            try {
              parsedState = JSON.parse(savedState);
            } catch {
              console.warn("[BuilderState] Corrupted localStorage data, discarding");
              return;
            }
            // Only restore data fields, not navigation state — user always starts at foundation
            const {
              step: _step,
              completedSteps: _completedSteps,
              selectedCountry: _selectedCountry,
              selectedArchetypeId: _selectedArchetypeId,
              ...dataFields
            } = parsedState;
            setBuilderState((prev) => ({
              ...prev,
              ...dataFields,
              economyBuilderState: parsedState.economyBuilderState ?? null,
            }));
            const hasProgress =
              !!parsedState.selectedCountry ||
              !!parsedState.selectedArchetypeId ||
              (!!parsedState.economicInputs && !!parsedState.economicInputs.countryName) ||
              (Array.isArray(parsedState.completedSteps) && parsedState.completedSteps.length > 0);
            if (hasProgress) {
              setHasRestoredState(true);
              // On-device draft wins over the server draft (it's the latest here).
              localHadDataRef.current = true;
            }
          }

          if (savedLastSaved) {
            setLastSaved(new Date(savedLastSaved));
          }
        }
      } catch (error) {
        // Failed to load saved state, continue with default
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, countryId, isLoadingCountry]);

  // Autosave state to localStorage with ref to prevent infinite loops
  const builderStateRef = useRef(builderState);
  builderStateRef.current = builderState;
  const prevBuilderStateRef = useRef(builderState);

  // Server-draft (create-mode) coordination refs.
  // localHadDataRef: the on-device localStorage restore found a draft (it wins).
  // serverRestoreDoneRef: we've decided whether to apply the server draft, so the
  // server-save effect may run without clobbering an unrestored draft with empty state.
  const localHadDataRef = useRef(false);
  const serverRestoreDoneRef = useRef(false);

  // Does the current state represent real user progress worth persisting?
  const hasBuilderProgress = (s: BuilderState): boolean =>
    !!s.selectedCountry ||
    !!s.selectedArchetypeId ||
    !!s.economicInputs?.countryName ||
    !!s.economicInputs?.nationalIdentity?.countryName ||
    (Array.isArray(s.completedSteps) && s.completedSteps.length > 0);

  useEffect(() => {
    // Skip save if state hasn't actually changed (prevents unnecessary JSON.stringify)
    if (isEqual(prevBuilderStateRef.current, builderState)) return;
    prevBuilderStateRef.current = builderState;

    const saveState = async () => {
      setIsAutoSaving(true);
      try {
        // Use country-specific keys in edit mode
        const stateKey =
          mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
        const savedKey =
          mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

        const stateSaved = safeSetItemSync(stateKey, JSON.stringify(builderStateRef.current));
        const now = new Date();
        const timestampSaved = safeSetItemSync(savedKey, now.toISOString());

        if (stateSaved && timestampSaved) {
          setLastSaved(now);
        } else {
          console.warn(
            "[BuilderState] Failed to save to localStorage, data may be lost on page refresh"
          );
          // Try fallback to sessionStorage
          try {
            sessionStorage.setItem(stateKey, JSON.stringify(builderStateRef.current));
            sessionStorage.setItem(savedKey, now.toISOString());
            console.log("[BuilderState] Fallback to sessionStorage successful");
          } catch (sessionError) {
            console.error(
              "[BuilderState] Both localStorage and sessionStorage failed:",
              sessionError
            );
          }
        }
      } catch (error) {
        console.error("[BuilderState] Failed to save state:", error);
      } finally {
        setIsAutoSaving(false);
      }
    };

    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [builderState, mode, countryId]);

  // Autosave on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        // Use country-specific keys in edit mode
        const stateKey =
          mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
        const savedKey =
          mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

        safeSetItemSync(stateKey, JSON.stringify(builderStateRef.current));
        safeSetItemSync(savedKey, new Date().toISOString());
      } catch (error) {
        // Failed to save state on unload
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [mode, countryId]);

  // Unified Builder Integration - Sync all data across subsystems with refs to prevent loops
  const latestRefs = useRef({
    economicInputs: builderState.economicInputs,
    governmentComponents: builderState.governmentComponents,
    governmentStructure: builderState.governmentStructure,
    taxSystemData: builderState.taxSystemData,
  });

  // Update refs when state changes
  latestRefs.current = {
    economicInputs: builderState.economicInputs,
    governmentComponents: builderState.governmentComponents,
    governmentStructure: builderState.governmentStructure,
    taxSystemData: builderState.taxSystemData,
  };

  // Track last sent values to prevent redundant updates
  // Phase 2 optimization: Store actual values instead of JSON strings for isEqual comparison
  const lastSentNationalIdentityRef = useRef<EconomicInputs["nationalIdentity"] | null>(null);
  const lastSentGovernmentComponentsRef = useRef<ComponentType[]>([]);
  const lastSentGovernmentStructureRef = useRef<GovernmentBuilderState | null>(null);
  const lastSentTaxSystemDataRef = useRef<TaxBuilderState | null>(null);

  // Phase 2 optimization: Replaced JSON.stringify with isEqual for performance
  useEffect(() => {
    // Update national identity if changed
    if (latestRefs.current.economicInputs?.nationalIdentity) {
      const currentIdentity = latestRefs.current.economicInputs.nationalIdentity;
      if (!isEqual(currentIdentity, lastSentNationalIdentityRef.current)) {
        lastSentNationalIdentityRef.current = currentIdentity;
        unifiedBuilderService.updateNationalIdentity({
          countryName: currentIdentity.countryName,
          capital: currentIdentity.capitalCity,
          currency: currentIdentity.currency,
          language: currentIdentity.officialLanguages || "",
          flag: undefined,
          anthem: currentIdentity.nationalAnthem,
          motto: currentIdentity.motto,
        });
      }
    }

    // Update government components if changed
    if (latestRefs.current.governmentComponents.length > 0) {
      if (
        !isEqual(latestRefs.current.governmentComponents, lastSentGovernmentComponentsRef.current)
      ) {
        lastSentGovernmentComponentsRef.current = [...latestRefs.current.governmentComponents];
        unifiedBuilderService.updateGovernmentComponents(latestRefs.current.governmentComponents);
        const suggested = unifiedBuilderService.getSuggestedEconomicComponents();
        console.log(`[UnifiedBuilder] Auto-selected ${suggested.length} economic components`);
      }
    }

    // Update government structure if changed
    if (latestRefs.current.governmentStructure) {
      if (
        !isEqual(latestRefs.current.governmentStructure, lastSentGovernmentStructureRef.current)
      ) {
        lastSentGovernmentStructureRef.current = latestRefs.current.governmentStructure;
        unifiedBuilderService.updateGovernmentBuilder(latestRefs.current.governmentStructure);
      }
    }

    // Update tax system data if changed
    if (latestRefs.current.taxSystemData) {
      if (!isEqual(latestRefs.current.taxSystemData, lastSentTaxSystemDataRef.current)) {
        lastSentTaxSystemDataRef.current = latestRefs.current.taxSystemData;
        unifiedBuilderService.updateTaxBuilder(latestRefs.current.taxSystemData);
      }
    }
  }, [
    // Use stable references instead of nested properties
    builderState.economicInputs,
    builderState.governmentComponents,
    builderState.governmentStructure,
    builderState.taxSystemData,
  ]);

  // DB Sync for Edit Mode
  const updateMutation = api.countries.updateCountry.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
    },
    onError: (err) => {
      console.error("[useBuilderState] DB sync error:", err);
    },
  });

  const syncError = updateMutation.error;
  const isSyncing = updateMutation.isPending;

  const lastSyncedStateRef = useRef<Parameters<typeof updateMutation.mutateAsync>[0] | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !countryId || !editModeInitialized.current || isLoadingCountry) {
      return;
    }

    const currentSyncPayload = {
      id: countryId,
      name:
        builderState.economicInputs?.countryName ||
        builderState.economicInputs?.nationalIdentity?.countryName ||
        "",
      economicInputs: sanitizeEconomicInputs(builderState.economicInputs) || undefined,
      // Send undefined (skip) rather than [] when there are no components: the
      // server treats a present array as authoritative and deletes-then-recreates,
      // so an empty array on a transient/unloaded state would wipe the DB's
      // components. ponytail: can't persist "user cleared all components" via
      // autosave; clearing all is rare and goes through explicit save/remove paths.
      governmentComponents:
        builderState.governmentComponents && builderState.governmentComponents.length > 0
          ? builderState.governmentComponents.map((comp) => ({ componentType: comp }))
          : undefined,
      taxSystemData: builderState.taxSystemData || undefined,
      governmentStructure: builderState.governmentStructure || undefined,
      economyBuilderState: builderState.economyBuilderState || undefined,
    };

    if (!lastSyncedStateRef.current) {
      lastSyncedStateRef.current = currentSyncPayload;
      return;
    }

    if (isEqual(lastSyncedStateRef.current, currentSyncPayload)) {
      return;
    }

    const triggerDbSync = async () => {
      try {
        lastSyncedStateRef.current = currentSyncPayload;
        await updateMutation.mutateAsync(currentSyncPayload);
      } catch (err) {
        // Handled by mutation onError
      }
    };

    const timer = setTimeout(triggerDbSync, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    builderState.economicInputs,
    builderState.governmentComponents,
    builderState.taxSystemData,
    builderState.governmentStructure,
    builderState.economyBuilderState,
    mode,
    countryId,
    isLoadingCountry,
  ]);

  // ── Server-side draft persistence (create mode) ──────────────────────────
  // Edit mode already persists to the Country row; this gives create-mode builds
  // cross-session / cross-device persistence for every authenticated user.
  const serverDraftQuery = api.builderDraft.get.useQuery(undefined, {
    enabled: mode !== "edit",
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const saveDraftMutation = api.builderDraft.save.useMutation();
  const clearDraftMutation = api.builderDraft.clear.useMutation();

  // Restore from the server draft only when this device has no local draft.
  useEffect(() => {
    if (mode === "edit") return;
    if (serverRestoreDoneRef.current) return;
    if (serverDraftQuery.isLoading) return; // wait for the query to settle

    serverRestoreDoneRef.current = true;

    // Local draft wins; never clobber it or an in-progress build.
    if (localHadDataRef.current || hasBuilderProgress(builderStateRef.current)) return;

    const remote = serverDraftQuery.data?.data as Partial<BuilderState> | undefined;
    if (!remote) return;

    // Restore data fields only — navigation always starts at foundation.
    const {
      step: _step,
      completedSteps: _completedSteps,
      selectedCountry: _selectedCountry,
      selectedArchetypeId: _selectedArchetypeId,
      ...dataFields
    } = remote as any;
    setBuilderState((prev) => ({
      ...prev,
      ...dataFields,
      economyBuilderState: (remote as any).economyBuilderState ?? prev.economyBuilderState ?? null,
    }));
    if (hasBuilderProgress(remote as BuilderState)) {
      setHasRestoredState(true);
    }
    if (serverDraftQuery.data?.updatedAt) {
      setLastSaved(new Date(serverDraftQuery.data.updatedAt));
    }
  }, [serverDraftQuery.isLoading, serverDraftQuery.data, mode]);

  // Debounced server save (create mode), gated on restore-decision + real progress
  // so we never overwrite a good server draft with the empty initial state.
  useEffect(() => {
    if (mode === "edit") return;
    if (!serverRestoreDoneRef.current) return;
    if (!hasBuilderProgress(builderState)) return;

    const timer = setTimeout(() => {
      saveDraftMutation.mutate({ data: builderStateRef.current });
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderState, mode]);

  const triggerManualSave = useCallback(async () => {
    const stateKey = mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
    const savedKey =
      mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

    // localStorage is best-effort — a storage failure must never block the DB save.
    try {
      safeSetItemSync(stateKey, JSON.stringify(builderStateRef.current));
      const now = new Date();
      safeSetItemSync(savedKey, now.toISOString());
      setLastSaved(now);
    } catch (error) {
      console.warn("Manual save: localStorage write failed:", error);
    }

    if (mode === "edit" && countryId && !isLoadingCountry) {
      const currentSyncPayload = {
        id: countryId,
        name:
          builderStateRef.current.economicInputs?.countryName ||
          builderStateRef.current.economicInputs?.nationalIdentity?.countryName ||
          "",
        economicInputs: sanitizeEconomicInputs(builderStateRef.current.economicInputs) || undefined,
        // Skip (undefined) rather than [] when empty: a present array is
        // authoritative server-side and would delete-then-recreate, wiping the
        // DB's components on a transient empty state. (Mirrors the autosave path.)
        governmentComponents:
          builderStateRef.current.governmentComponents &&
          builderStateRef.current.governmentComponents.length > 0
            ? builderStateRef.current.governmentComponents.map((comp) => ({
                componentType: comp,
              }))
            : undefined,
        taxSystemData: builderStateRef.current.taxSystemData || undefined,
        governmentStructure: builderStateRef.current.governmentStructure || undefined,
        economyBuilderState: builderStateRef.current.economyBuilderState || undefined,
      };
      lastSyncedStateRef.current = currentSyncPayload;
      // Let the error propagate so callers (the DI Save button) can surface a real
      // failure instead of flashing a false "Saved".
      await updateMutation.mutateAsync(currentSyncPayload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, countryId, isLoadingCountry]);

  // Update handlers
  const updateEconomicInputs = useCallback((inputs: EconomicInputs) => {
    setBuilderState((prev) => {
      const sanitized = sanitizeEconomicInputs(inputs);
      const nextState = { ...prev, economicInputs: sanitized };

      if (nextState.economyBuilderState) {
        const totalPopulation = sanitized.coreIndicators?.totalPopulation;
        if (totalPopulation !== undefined) {
          const participationRate =
            nextState.economyBuilderState.laborMarket?.laborForceParticipationRate ?? 65;
          const totalWorkforce =
            sanitized.laborEmployment?.totalWorkforce ||
            Math.round(totalPopulation * (participationRate / 100));
          nextState.economyBuilderState = {
            ...nextState.economyBuilderState,
            demographics: {
              ...nextState.economyBuilderState.demographics,
              totalPopulation,
            },
            laborMarket: {
              ...nextState.economyBuilderState.laborMarket,
              totalWorkforce,
            },
          };
        }
      }

      const currency = sanitized.nationalIdentity?.currency;
      if (currency) {
        const symbol = sanitized.nationalIdentity?.currencySymbol || "$";
        registerCustomCurrency(currency, symbol);

        if (nextState.governmentStructure?.structure) {
          nextState.governmentStructure = {
            ...nextState.governmentStructure,
            structure: {
              ...nextState.governmentStructure.structure,
              budgetCurrency: currency,
            },
          };
        }
      }
      return nextState;
    });
  }, []);

  const updateGovernmentComponents = useCallback((components: ComponentType[]) => {
    setBuilderState((prev) => ({ ...prev, governmentComponents: components }));
  }, []);

  const updateGovernmentStructure = useCallback((structure: any) => {
    setBuilderState((prev) => ({ ...prev, governmentStructure: structure }));
  }, []);

  const updateTaxSystem = useCallback((taxData: TaxBuilderState) => {
    setBuilderState((prev) => ({ ...prev, taxSystemData: taxData }));
  }, []);

  const updateEconomyBuilderState = useCallback((economyState: EconomyBuilderState | null) => {
    setBuilderState((prev) => ({ ...prev, economyBuilderState: economyState }));
  }, []);

  const updateArchetypeId = useCallback((id: string | null) => {
    setBuilderState((prev) => ({ ...prev, selectedArchetypeId: id }));
  }, []);

  const updateStep = useCallback(
    (step: BuilderStep, data?: any) => {
      setBuilderState((prev) => {
        const newState = { ...prev };

        if (!prev.completedSteps.includes(step)) {
          newState.completedSteps = [...prev.completedSteps, step];
        }

        switch (step) {
          case "foundation":
            newState.selectedCountry = data;
            newState.economyBuilderState = null;
            if (data) {
              newState.economicInputs = sanitizeEconomicInputs(createDefaultEconomicInputs(data));

              // Load selected archetype presets if an archetype was chosen
              const archetype = newState.selectedArchetypeId
                ? modernArchetypes.get(newState.selectedArchetypeId) ||
                  historicalArchetypes.get(newState.selectedArchetypeId)
                : null;

              if (archetype) {
                // 1. Update government components
                if (archetype.governmentComponents) {
                  newState.governmentComponents = mapLegacyGovernmentComponents(
                    archetype.governmentComponents as string[]
                  );
                }

                // 2. Update economic components in economyBuilderState
                if (archetype.economicComponents) {
                  newState.economyBuilderState = {
                    selectedAtomicComponents: archetype.economicComponents,
                    structure: {
                      sectors: [],
                    } as any,
                    sectors: [],
                    laborMarket: {
                      unemploymentRate: archetype.employmentProfile?.unemploymentRate ?? 5.0,
                      participationRate: archetype.employmentProfile?.laborParticipation ?? 65.0,
                    } as any,
                    demographics: {} as any,
                    isValid: true,
                    errors: {},
                    lastUpdated: new Date(),
                    version: "1.0.0",
                  };
                }

                // 3. Initialize tax system with archetype profiles if needed
                if (archetype.taxProfile) {
                  newState.taxSystemData = {
                    taxSystem: {
                      taxSystemName: `${data.name} Tax System`,
                      fiscalYear: "Calendar Year",
                      progressiveTax: true,
                      alternativeMinTax: false,
                    },
                    categories: [
                      {
                        categoryName: "Personal Income Tax",
                        categoryType: "Direct Tax",
                        description: "Tax on personal earnings",
                        isActive: true,
                        calculationMethod: "percentage",
                        baseRate: archetype.taxProfile.incomeRate,
                        deductionAllowed: true,
                        priority: 10,
                        color: "#3b82f6",
                      },
                      {
                        categoryName: "Corporate Income Tax",
                        categoryType: "Direct Tax",
                        description: "Tax on corporate profits",
                        isActive: true,
                        calculationMethod: "percentage",
                        baseRate: archetype.taxProfile.corporateRate,
                        deductionAllowed: true,
                        priority: 20,
                        color: "#10b981",
                      },
                      {
                        categoryName: "Consumption/Sales Tax",
                        categoryType: "Indirect Tax",
                        description: "Tax on goods and services",
                        isActive: true,
                        calculationMethod: "percentage",
                        baseRate: archetype.taxProfile.consumptionRate,
                        deductionAllowed: false,
                        priority: 30,
                        color: "#f59e0b",
                      },
                    ],
                    brackets: {},
                    exemptions: [],
                    deductions: {},
                    isValid: true,
                    errors: {},
                  };
                }
              }

              // Also update/initialize government structure with the foundation defaults if it hasn't been edited
              if (
                !newState.governmentStructure ||
                !newState.governmentStructure.structure ||
                newState.governmentStructure.structure.governmentName === "Government of the Nation"
              ) {
                newState.governmentStructure = {
                  structure: {
                    governmentName: `Government of ${data.name}`,
                    governmentType: (archetype?.name || data.governmentType || "Other") as any,
                    headOfState: "",
                    headOfGovernment: "",
                    legislatureName: "",
                    executiveName: "",
                    judicialName: "",
                    totalBudget: (data.gdp || 1000000000) * 0.35,
                    fiscalYear: "Calendar Year",
                    budgetCurrency: data.currency || "USD",
                  },
                  departments: [],
                  budgetAllocations: [],
                  revenueSources: [],
                  isValid: true,
                  errors: { structure: [], departments: {}, budget: [], revenue: [] },
                };
              }
            }
            break;
          case "core":
            newState.economicInputs = sanitizeEconomicInputs(data);
            if (data) {
              // Update governmentStructure defaults using user's custom name, gdp, currency
              const inputs = data as EconomicInputs;
              const hasCustomizedStructure =
                newState.governmentStructure &&
                newState.governmentStructure.structure &&
                newState.governmentStructure.structure.governmentName !==
                  "Government of the Nation" &&
                !newState.governmentStructure.structure.governmentName.startsWith(
                  "Government of Custom Nation"
                ) &&
                (!newState.selectedCountry ||
                  newState.governmentStructure.structure.governmentName !==
                    `Government of ${newState.selectedCountry.name}`);

              if (
                !newState.governmentStructure ||
                !newState.governmentStructure.structure ||
                !hasCustomizedStructure
              ) {
                const countryName =
                  inputs.countryName || newState.selectedCountry?.name || "the Nation";
                const govType = inputs.nationalIdentity?.governmentType || "Other";
                const nominalGDP = inputs.coreIndicators?.nominalGDP || 1000000000;
                const currency = inputs.nationalIdentity?.currency || "USD";

                newState.governmentStructure = {
                  ...newState.governmentStructure,
                  structure: {
                    governmentName: `Government of ${countryName}`,
                    governmentType: govType as any,
                    headOfState: newState.governmentStructure?.structure?.headOfState || "",
                    headOfGovernment:
                      newState.governmentStructure?.structure?.headOfGovernment || "",
                    legislatureName: newState.governmentStructure?.structure?.legislatureName || "",
                    executiveName: newState.governmentStructure?.structure?.executiveName || "",
                    judicialName: newState.governmentStructure?.structure?.judicialName || "",
                    totalBudget: nominalGDP * 0.35,
                    fiscalYear:
                      newState.governmentStructure?.structure?.fiscalYear || "Calendar Year",
                    budgetCurrency: currency,
                  },
                  departments: newState.governmentStructure?.departments || [],
                  budgetAllocations: newState.governmentStructure?.budgetAllocations || [],
                  revenueSources: newState.governmentStructure?.revenueSources || [],
                  isValid: true,
                  errors: newState.governmentStructure?.errors || {
                    structure: [],
                    departments: {},
                    budget: [],
                    revenue: [],
                  },
                };
              }
            }
            break;
          case "government":
            newState.governmentComponents = data;
            break;
          case "economics":
            newState.economicInputs = sanitizeEconomicInputs(data);
            break;
        }

        const steps = getStepsForMode(mode);
        const currentIndex = steps.indexOf(step);
        if (currentIndex !== -1 && currentIndex < steps.length - 1) {
          newState.step = steps[currentIndex + 1]!;
        }

        return newState;
      });
    },
    [mode]
  );

  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        // Use country-specific keys in edit mode
        const stateKey =
          mode === "edit" && countryId ? `builder_state_${countryId}` : "builder_state";
        const savedKey =
          mode === "edit" && countryId ? `builder_last_saved_${countryId}` : "builder_last_saved";

        localStorage.removeItem(stateKey);
        localStorage.removeItem(savedKey);
      }
      // Also clear the server-side create-mode draft (best-effort).
      if (mode !== "edit") {
        clearDraftMutation.mutate();
      }
      setLastSaved(null);
      setBuilderState(getInitialState(mode));
    } catch (error) {
      // Failed to clear draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, countryId]);

  const canAccessStep = useCallback(
    (step: BuilderStep): boolean => {
      const steps = getStepsForMode(mode);
      if (!steps.includes(step)) return false;
      const currentIndex = steps.indexOf(builderState.step);
      const targetIndex = steps.indexOf(step);
      return targetIndex <= currentIndex || builderState.completedSteps.includes(step);
    },
    [builderState.step, builderState.completedSteps, mode]
  );

  return {
    builderState,
    setBuilderState,
    lastSaved,
    isAutoSaving,
    isLoadingCountry,
    countryId,
    mode,
    enabledSteps: getStepsForMode(mode),
    isSyncing,
    syncError,
    selectedArchetypeId: builderState.selectedArchetypeId,
    updateArchetypeId,
    updateEconomicInputs,
    updateGovernmentComponents,
    updateGovernmentStructure,
    updateTaxSystem,
    updateEconomyBuilderState,
    updateStep,
    clearDraft,
    canAccessStep,
    triggerManualSave,
    hasRestoredState,
  };
}

export function sanitizeEconomicInputs(inputs: any): any {
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
    const toBoundedPercent = (value: unknown, fallback: number) => {
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
  return clean;
}
