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
import type { BuilderStep } from "../components/enhanced/builderConfig";
import type { RealCountryData, EconomicInputs } from "../lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { ComponentType } from "@prisma/client";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { safeGetItemSync, safeSetItemSync, safeRemoveItemSync } from "~/lib/localStorageMutex";
import { createDefaultEconomicInputs } from "../lib/economy-data-service";
import { unifiedBuilderService } from "../services/UnifiedBuilderIntegrationService";
import { api } from "~/trpc/react";

/**
 * Complete state structure for the country builder workflow.
 * Tracks progress through all builder steps and maintains data integrity.
 */
export interface BuilderState {
  /** Current active step in the builder workflow */
  step: BuilderStep;
  /** Foundation country selected as starting point (optional) */
  selectedCountry: RealCountryData | null;
  /** All economic indicators and metrics for the country */
  economicInputs: EconomicInputs | null;
  /** Selected atomic government components */
  governmentComponents: ComponentType[];
  /** Tax system configuration and brackets */
  taxSystemData: TaxBuilderState | null;
  /** Traditional government builder structure */
  governmentStructure: any;
  /** Steps that have been completed by the user */
  completedSteps: BuilderStep[];
  /** Active tab within the Core step */
  activeCoreTab: string;
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
}

const baseInitialState: BuilderState = {
  step: "foundation",
  selectedCountry: null,
  economicInputs: null,
  governmentComponents: [],
  taxSystemData: null,
  governmentStructure: null,
  completedSteps: [],
  activeCoreTab: "identity",
  activeGovernmentTab: "components",
  activeEconomicsTab: "economy",
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
  const [builderState, setBuilderState] = useState<BuilderState>(() => getInitialState(mode));
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const quickStartProcessed = useRef(false);
  const editModeInitialized = useRef(false);

  // Edit mode: Load existing country data
  const { data: existingCountry, isLoading: countryLoading } = api.countries.getByIdAtTime.useQuery(
    { id: countryId || "" },
    {
      enabled: mode === "edit" && !!countryId && countryId.trim() !== "",
      retry: false,
    }
  );

  const { data: existingGovernment, isLoading: governmentLoading } =
    api.government.getByCountryId.useQuery(
      { countryId: countryId || "" },
      { enabled: mode === "edit" && !!countryId }
    );

  const { data: existingTaxSystem, isLoading: taxSystemLoading } =
    api.taxSystem.getByCountryId.useQuery(
      { countryId: countryId || "" },
      { enabled: mode === "edit" && !!countryId }
    );

  const isLoadingCountry =
    mode === "edit" && (countryLoading || governmentLoading || taxSystemLoading);

  // Initialize edit mode with existing data
  useEffect(() => {
    if (mode === "edit" && existingCountry && !editModeInitialized.current && !isLoadingCountry) {
      editModeInitialized.current = true;

      const inputs = createDefaultEconomicInputs();

      // Populate with live country data
      inputs.countryName = existingCountry.name;

      const calculatedStats = (existingCountry as any).calculatedStats;
      const currentPop =
        Number(calculatedStats?.currentPopulation) ||
        Number((existingCountry as any).baselinePopulation) ||
        0;
      const currentGdpPerCap =
        Number(calculatedStats?.currentGdpPerCapita) ||
        Number((existingCountry as any).baselineGdpPerCapita) ||
        0;
      const currentTotalGdp = Number(calculatedStats?.currentTotalGdp) || 0;

      inputs.coreIndicators = {
        totalPopulation: !isNaN(currentPop) ? currentPop : 0,
        gdpPerCapita: !isNaN(currentGdpPerCap) ? currentGdpPerCap : 0,
        nominalGDP: !isNaN(currentTotalGdp) ? currentTotalGdp : 0,
        realGDPGrowthRate: (existingCountry as any).realGDPGrowthRate ?? 0,
        inflationRate: (existingCountry as any).inflationRate ?? 0,
        currencyExchangeRate: (existingCountry as any).currencyExchangeRate ?? 1.0,
      };

      // Labor & Employment
      inputs.laborEmployment.unemploymentRate = (existingCountry as any).unemploymentRate ?? 0;
      inputs.laborEmployment.laborForceParticipationRate =
        (existingCountry as any).laborForceParticipationRate ?? 0;
      inputs.laborEmployment.employmentRate = (existingCountry as any).employmentRate ?? 0;
      inputs.laborEmployment.totalWorkforce = (existingCountry as any).totalWorkforce ?? 0;
      inputs.laborEmployment.averageWorkweekHours =
        (existingCountry as any).averageWorkweekHours ?? 0;
      inputs.laborEmployment.minimumWage = (existingCountry as any).minimumWage ?? 0;
      inputs.laborEmployment.averageAnnualIncome =
        (existingCountry as any).averageAnnualIncome ?? 0;

      // Fiscal system
      inputs.fiscalSystem.taxRevenueGDPPercent = (existingCountry as any).taxRevenueGDPPercent ?? 0;
      inputs.fiscalSystem.governmentRevenueTotal =
        (existingCountry as any).governmentRevenueTotal ?? 0;
      inputs.fiscalSystem.totalDebtGDPRatio = (existingCountry as any).totalDebtGDPRatio ?? 0;
      inputs.fiscalSystem.budgetDeficitSurplus = (existingCountry as any).budgetDeficitSurplus ?? 0;
      inputs.fiscalSystem.governmentBudgetGDPPercent =
        (existingCountry as any).governmentBudgetGDPPercent ?? 0;
      inputs.fiscalSystem.internalDebtGDPPercent =
        (existingCountry as any).internalDebtGDPPercent ?? 0;
      inputs.fiscalSystem.externalDebtGDPPercent =
        (existingCountry as any).externalDebtGDPPercent ?? 0;
      inputs.fiscalSystem.interestRates = (existingCountry as any).interestRates ?? 0;
      inputs.fiscalSystem.debtServiceCosts = (existingCountry as any).debtServiceCosts ?? 0;

      // Demographics
      inputs.demographics.lifeExpectancy = (existingCountry as any).lifeExpectancy ?? 0;
      inputs.demographics.literacyRate = (existingCountry as any).literacyRate ?? 0;
      if ((existingCountry as any).urbanPopulationPercent !== undefined) {
        inputs.demographics.urbanRuralSplit = {
          urban: (existingCountry as any).urbanPopulationPercent,
          rural: 100 - (existingCountry as any).urbanPopulationPercent,
        };
      }

      // Income & Wealth Distribution
      inputs.incomeWealth.povertyRate = (existingCountry as any).povertyRate ?? 0;
      inputs.incomeWealth.incomeInequalityGini = (existingCountry as any).incomeInequalityGini ?? 0;
      inputs.incomeWealth.socialMobilityIndex = (existingCountry as any).socialMobilityIndex ?? 0;

      // Government Spending
      inputs.governmentSpending.totalSpending =
        (existingCountry as any).totalGovernmentSpending ?? 0;
      inputs.governmentSpending.spendingGDPPercent =
        (existingCountry as any).spendingGDPPercent ?? 0;
      inputs.governmentSpending.spendingPerCapita = (existingCountry as any).spendingPerCapita ?? 0;
      inputs.governmentSpending.deficitSurplus = (existingCountry as any).budgetDeficitSurplus ?? 0;

      // National Identity
      const nationalIdentity = (existingCountry as any).nationalIdentity;
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
        currency: nationalIdentity?.currency || (existingCountry as any).currencyName || "",
        currencySymbol:
          nationalIdentity?.currencySymbol || (existingCountry as any).currencySymbol || "$",
        officialLanguages: nationalIdentity?.officialLanguages || "",
        nationalLanguage: nationalIdentity?.nationalLanguage || "",
        nationalAnthem: nationalIdentity?.nationalAnthem || "",
        nationalReligion:
          nationalIdentity?.nationalReligion || (existingCountry as any).religion || "",
        nationalDay: nationalIdentity?.nationalDay || "",
        callingCode: nationalIdentity?.callingCode || "",
        internetTLD: nationalIdentity?.internetTLD || "",
        drivingSide: nationalIdentity?.drivingSide || "right",
        timeZone: nationalIdentity?.timeZone || "",
        isoCode: nationalIdentity?.isoCode || (existingCountry as any).countryCode || "",
        coordinatesLatitude: nationalIdentity?.coordinatesLatitude || "",
        coordinatesLongitude: nationalIdentity?.coordinatesLongitude || "",
        emergencyNumber: nationalIdentity?.emergencyNumber || "",
        postalCodeFormat: nationalIdentity?.postalCodeFormat || "",
        nationalSport: nationalIdentity?.nationalSport || "",
        weekStartDay: nationalIdentity?.weekStartDay || "monday",
      };

      inputs.flagUrl = nationalIdentity?.flagUrl || "";
      inputs.coatOfArmsUrl = nationalIdentity?.coatOfArmsUrl || "";

      // Geography
      inputs.geography = {
        continent: existingCountry.continent || "",
        region: existingCountry.region || "",
      };

      // Convert existing government to builder format
      let governmentStructure = null;
      if (existingGovernment) {
        governmentStructure = {
          structure: {
            governmentName: existingGovernment.governmentName,
            governmentType: existingGovernment.governmentType,
            headOfState: existingGovernment.headOfState ?? undefined,
            headOfGovernment: existingGovernment.headOfGovernment ?? undefined,
            legislatureName: existingGovernment.legislatureName ?? undefined,
            executiveName: existingGovernment.executiveName ?? undefined,
            judicialName: existingGovernment.judicialName ?? undefined,
            totalBudget: existingGovernment.totalBudget,
            fiscalYear: existingGovernment.fiscalYear,
            budgetCurrency: existingGovernment.budgetCurrency,
          },
          departments: (existingGovernment.departments as any[]).map((dept: any) => ({
            name: dept.name,
            shortName: dept.shortName ?? undefined,
            category: dept.category,
            description: dept.description ?? undefined,
            minister: dept.minister ?? undefined,
            ministerTitle: dept.ministerTitle ?? undefined,
            headquarters: dept.headquarters ?? undefined,
            established: dept.established ?? undefined,
            employeeCount: dept.employeeCount ?? undefined,
            icon: dept.icon ?? undefined,
            color: dept.color ?? undefined,
            priority: dept.priority ?? undefined,
            parentDepartmentId: dept.parentDepartmentId ?? undefined,
            organizationalLevel: dept.organizationalLevel ?? undefined,
            functions: Array.isArray(dept.functions) ? dept.functions : [],
          })),
          budgetAllocations: existingGovernment.budgetAllocations,
          revenueSources: existingGovernment.revenueSources,
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
        economicInputs: inputs,
        governmentComponents: [], // TODO: Extract from existing government if atomic components exist
        taxSystemData,
        governmentStructure,
        completedSteps: ["foundation"], // Auto-complete foundation step
        activeCoreTab: "identity",
        activeGovernmentTab: "components",
        activeEconomicsTab: "economy",
        showAdvancedMode: false,
        economyBuilderState: null,
      });

      console.log(
        "[useBuilderState] Edit mode initialized with existing country data:",
        existingCountry.name
      );
    }
  }, [mode, existingCountry, existingGovernment, existingTaxSystem, isLoadingCountry]);

  // Load saved state on mount (create mode only)
  useEffect(() => {
    // Skip localStorage in edit mode
    if (mode === "edit") return;

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

          // Core indicators
          if (wikiData.population) {
            inputs.coreIndicators.totalPopulation = Number(wikiData.population) || 10000000;
          }
          if (wikiData.gdpPerCapita) {
            inputs.coreIndicators.gdpPerCapita = Number(wikiData.gdpPerCapita) || 25000;
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
              nationalDay: "",
              callingCode: "",
              internetTLD: "",
              drivingSide: "right",
            };
          }

          if (wikiData.capital) {
            inputs.nationalIdentity.capitalCity = wikiData.capital;
          }
          if (wikiData.currency) {
            inputs.nationalIdentity.currency = wikiData.currency;
          }
          if (wikiData.languages) {
            inputs.nationalIdentity.officialLanguages = wikiData.languages;
          }
          if (wikiData.name) {
            inputs.nationalIdentity.countryName = wikiData.name;
          }

          // Flag URL
          if (wikiData.flagUrl) {
            inputs.flagUrl = wikiData.flagUrl;
          }

          // Set builder state with imported data
          setBuilderState((prev) => ({
            ...prev,
            step: "core",
            economicInputs: inputs,
            completedSteps: ["foundation"],
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
          const parsedState = JSON.parse(savedState);
          setBuilderState((prev) => ({
            ...prev,
            ...parsedState,
            economyBuilderState: parsedState.economyBuilderState ?? null,
          }));
        }

        if (savedLastSaved) {
          setLastSaved(new Date(savedLastSaved));
        }
      }
    } catch (error) {
      // Failed to load saved state, continue with default
    }
  }, [mode]);

  // Autosave state to localStorage with ref to prevent infinite loops
  const builderStateRef = useRef(builderState);
  builderStateRef.current = builderState;

  useEffect(() => {
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
  const economicInputsRef = useRef(builderState.economicInputs);
  const governmentComponentsRef = useRef(builderState.governmentComponents);
  const governmentStructureRef = useRef(builderState.governmentStructure);
  const taxSystemDataRef = useRef(builderState.taxSystemData);

  // Update refs when state changes
  economicInputsRef.current = builderState.economicInputs;
  governmentComponentsRef.current = builderState.governmentComponents;
  governmentStructureRef.current = builderState.governmentStructure;
  taxSystemDataRef.current = builderState.taxSystemData;

  // Track last sent values to prevent redundant updates
  const lastSentNationalIdentityRef = useRef<string>("");
  const lastSentGovernmentComponentsRef: React.MutableRefObject<string> = useRef<string>(""); // Track last sent components
  const lastSentGovernmentStructureRef = useRef<string>("");
  const lastSentTaxSystemDataRef = useRef<string>("");

  useEffect(() => {
    // Update national identity if changed
    if (economicInputsRef.current?.nationalIdentity) {
      const identityKey = JSON.stringify(economicInputsRef.current.nationalIdentity);
      if (identityKey !== lastSentNationalIdentityRef.current) {
        lastSentNationalIdentityRef.current = identityKey;
        unifiedBuilderService.updateNationalIdentity({
          countryName: economicInputsRef.current.nationalIdentity.countryName,
          capital: economicInputsRef.current.nationalIdentity.capitalCity,
          currency: economicInputsRef.current.nationalIdentity.currency,
          language: economicInputsRef.current.nationalIdentity.officialLanguages || "",
          flag: undefined,
          anthem: economicInputsRef.current.nationalIdentity.nationalAnthem,
          motto: economicInputsRef.current.nationalIdentity.motto,
        });
      }
    }

    // Update government components if changed
    if (governmentComponentsRef.current.length > 0) {
      const componentsKey = JSON.stringify(governmentComponentsRef.current);
      if (componentsKey !== lastSentGovernmentComponentsRef.current) {
        lastSentGovernmentComponentsRef.current = componentsKey;
        unifiedBuilderService.updateGovernmentComponents(governmentComponentsRef.current);
        const suggested = unifiedBuilderService.getSuggestedEconomicComponents();
        console.log(`[UnifiedBuilder] Auto-selected ${suggested.length} economic components`);
      }
    }

    // Update government structure if changed
    if (governmentStructureRef.current) {
      const structureKey = JSON.stringify(governmentStructureRef.current);
      if (structureKey !== lastSentGovernmentStructureRef.current) {
        lastSentGovernmentStructureRef.current = structureKey;
        unifiedBuilderService.updateGovernmentBuilder(governmentStructureRef.current);
      }
    }

    // Update tax system data if changed
    if (taxSystemDataRef.current) {
      const taxKey = JSON.stringify(taxSystemDataRef.current);
      if (taxKey !== lastSentTaxSystemDataRef.current) {
        lastSentTaxSystemDataRef.current = taxKey;
        unifiedBuilderService.updateTaxBuilder(taxSystemDataRef.current);
      }
    }
  }, [
    // Use stable references instead of nested properties
    builderState.economicInputs,
    builderState.governmentComponents,
    builderState.governmentStructure,
    builderState.taxSystemData,
  ]);

  // Update handlers
  const updateEconomicInputs = useCallback((inputs: EconomicInputs) => {
    setBuilderState((prev) => ({ ...prev, economicInputs: inputs }));
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

  const updateStep = useCallback((step: BuilderStep, data?: any) => {
    setBuilderState((prev) => {
      const newState = { ...prev };

      if (!prev.completedSteps.includes(step)) {
        newState.completedSteps = [...prev.completedSteps, step];
      }

      switch (step) {
        case "foundation":
          newState.selectedCountry = data;
          newState.step = "core";
          if (data) {
            newState.economicInputs = createDefaultEconomicInputs(data);
          }
          break;
        case "core":
          newState.economicInputs = data;
          newState.step = "government";
          break;
        case "government":
          newState.governmentComponents = data;
          newState.step = "economics";
          break;
        case "economics":
          newState.economicInputs = data;
          newState.step = "preview";
          break;
      }

      return newState;
    });
  }, []);

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
      setLastSaved(null);
      setBuilderState(getInitialState(mode));
    } catch (error) {
      // Failed to clear draft
    }
  }, [mode, countryId]);

  const canAccessStep = useCallback(
    (step: BuilderStep): boolean => {
      const stepOrder: BuilderStep[] = ["foundation", "core", "government", "economics", "preview"];
      const currentIndex = stepOrder.indexOf(builderState.step);
      const targetIndex = stepOrder.indexOf(step);
      return targetIndex <= currentIndex || builderState.completedSteps.includes(step);
    },
    [builderState.step, builderState.completedSteps]
  );

  return {
    builderState,
    setBuilderState,
    lastSaved,
    isAutoSaving,
    isLoadingCountry,
    countryId,
    updateEconomicInputs,
    updateGovernmentComponents,
    updateGovernmentStructure,
    updateTaxSystem,
    updateEconomyBuilderState,
    updateStep,
    clearDraft,
    canAccessStep,
  };
}
