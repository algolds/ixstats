import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  safeGetItemSync,
  safeRemoveItemSync,
} from "~/lib/system/local-storage-mutex";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import {
  createDefaultEconomicInputs,
  type EconomicInputs,
} from "../lib/economy-data-service";
import type { CountryWithEditorFields } from "~/types/country-editor";
import type {
  GovernmentDepartment,
  GovernmentBuilderState,
  GovernmentType,
  DepartmentInput,
  DepartmentCategory,
  OrganizationalLevel,
  RevenueCategory,
} from "~/types/government";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import { createDefaultEconomyBuilderState } from "../components/enhanced/economy-builder/economyStateUtils";
import type {
  EconomyBuilderState,
  SectorConfiguration,
  RegionDistribution,
  DemographicsConfiguration,
} from "~/types/economy-builder";

function toRevenueCategory(cat: string | null | undefined): RevenueCategory {
  switch (cat) {
    case "Direct Tax":
    case "Indirect Tax":
    case "Non-Tax Revenue":
    case "Fees and Fines":
    case "Other":
      return cat;
    case "Tax":
      return "Direct Tax";
    case "Fee":
      return "Fees and Fines";
    case "Grant":
    case "Resource":
    case "Enterprise":
      return "Non-Tax Revenue";
    default:
      return "Other";
  }
}
import type {
  NationalIdentityData,
  DemographicData,
  AgeGroup,
  EducationLevel,
  Region,
  EconomicClass,
} from "../lib/economy-types";
import type { SpendingCategoryData } from "../utils/governmentValidation";
import type { ComponentType } from "~/lib/enums";
import type { EconomicComponentType } from "~/lib/economy/atomic-data";
import {
  type BuilderState,
  sanitizeEconomicInputs,
} from "./builderStateTypes";

interface UseBuilderEditModeProps {
  mode: "create" | "edit";
  countryId?: string;
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  setHasRestoredState: (restored: boolean) => void;
  setLastSaved: (date: Date | null) => void;
}

type RawJsonValue =
  | string
  | number
  | boolean
  | null
  | Record<string, string | number | boolean | null>
  | Array<Record<string, string | number | boolean | null>>;

interface EditorRelationsData {
  demographics?: {
    ageDistribution?: RawJsonValue;
    educationLevels?: RawJsonValue;
    regions?: RawJsonValue;
  } | null;
  incomeDistribution?: {
    economicClasses?: RawJsonValue;
  } | null;
  governmentBudget?: {
    spendingCategories?: RawJsonValue;
  } | null;
  governmentComponents?: Array<{ componentType: string }>;
  economicComponents?: Array<{ componentType: string }>;
  economicProfile?: {
    sectorBreakdown?: string | null;
  } | null;
}

export function useBuilderEditMode({
  mode,
  countryId,
  setBuilderState,
  setHasRestoredState,
  setLastSaved,
}: UseBuilderEditModeProps) {
  const notify = useNotify();
  const editModeInitialized = useRef(false);
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
        staleTime: 5 * 60 * 1000,
      }
    );

  const { data: existingTaxSystem, isLoading: taxSystemLoading } =
    api.taxSystem.getByCountryId.useQuery(
      { countryId: countryId || "" },
      {
        enabled: mode === "edit" && !!countryId,
        staleTime: 5 * 60 * 1000,
      }
    );

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
        countryCode: typedCountry.countryCode || "us",
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
      const nationalIdentity = typedCountry.nationalIdentity as
        | (Partial<NationalIdentityData> & {
            flagUrl?: string;
            coatOfArmsUrl?: string;
            foundersImage?: string;
            nationalFlowerImage?: string;
            nationalDishImage?: string;
            nationalFruitImage?: string;
            nationalDrinkImage?: string;
            nationalInstrumentImage?: string;
            nationalSymbolImage?: string;
          })
        | undefined;
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
        drivingSide: nationalIdentity?.drivingSide === "left" ? "left" : "right",
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

      // Hydrate relational subsystems
      const parseJsonArray = <T>(v: RawJsonValue | undefined | null): T[] => {
        if (Array.isArray(v)) return v as T[];
        if (typeof v === "string" && v.trim()) {
          try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? (parsed as T[]) : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const rel = editorRelations as EditorRelationsData | undefined;
      if (rel?.demographics) {
        const ageDist = parseJsonArray<AgeGroup>(rel.demographics.ageDistribution);
        if (ageDist.length) inputs.demographics.ageDistribution = ageDist;
        const eduLevels = parseJsonArray<EducationLevel>(rel.demographics.educationLevels);
        if (eduLevels.length) Reflect.set(inputs.demographics, "educationLevels", eduLevels);
        const regions = parseJsonArray<Region>(rel.demographics.regions);
        if (regions.length) Reflect.set(inputs.demographics, "regions", regions);
      }
      if (rel?.incomeDistribution?.economicClasses) {
        const classes = parseJsonArray<EconomicClass>(rel.incomeDistribution.economicClasses);
        if (classes.length) Reflect.set(inputs.incomeWealth, "economicClasses", classes);
      }
      if (rel?.governmentBudget?.spendingCategories) {
        const cats = parseJsonArray<SpendingCategoryData>(rel.governmentBudget.spendingCategories);
        if (cats.length) Reflect.set(inputs.governmentSpending, "spendingCategories", cats);
      }

      // Atomic government components
      const loadedGovernmentComponents: ComponentType[] = (rel?.governmentComponents || []).map(
        (c) => c.componentType as ComponentType
      );

      // Economy builder state
      let loadedEconomyBuilderState: EconomyBuilderState | null = null;
      const economicComps = rel?.economicComponents || [];
      let parsedStructure: EconomyBuilderState["structure"] | null = null;
      if (rel?.economicProfile?.sectorBreakdown) {
        try {
          parsedStructure = JSON.parse(rel.economicProfile.sectorBreakdown);
        } catch {
          parsedStructure = null;
        }
      }
      if (economicComps.length > 0 || parsedStructure) {
        const defaultState = createDefaultEconomyBuilderState(inputs);
        if (parsedStructure) {
          defaultState.structure = {
            ...defaultState.structure,
            ...parsedStructure,
          };
        }
        loadedEconomyBuilderState = {
          ...defaultState,
          selectedAtomicComponents: economicComps.map(
            (c) => c.componentType as EconomicComponentType
          ),
          isValid: true,
          errors: {},
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
          departments: existingGovernment.departments.map(
            (dept) =>
              ({
                name: dept.name,
                shortName: dept.shortName ?? undefined,
                category: dept.category as DepartmentCategory,
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
                organizationalLevel: (dept.organizationalLevel || "Department") as OrganizationalLevel,
                functions: (() => {
                  try {
                    return Array.isArray(dept.functions)
                      ? dept.functions
                      : typeof dept.functions === "string"
                        ? JSON.parse(dept.functions)
                        : [];
                  } catch {
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
                  } catch {
                    return [];
                  }
                })(),
              }) as DepartmentInput
          ),
          budgetAllocations: existingGovernment.budgetAllocations.map((alloc) => ({
            departmentId: alloc.departmentId,
            budgetYear: alloc.budgetYear,
            allocatedAmount: alloc.allocatedAmount,
            allocatedPercent: alloc.allocatedPercent,
            notes: alloc.notes ?? undefined,
          })),
          revenueSources: existingGovernment.revenueSources.map((rev) => ({
            name: rev.name,
            category: toRevenueCategory(rev.category),
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
      let taxSystemData: TaxBuilderState | null = null;
      if (existingTaxSystem) {
        taxSystemData = existingTaxSystem as TaxBuilderState;
      }

      setBuilderState((prev) => ({
        step: "core",
        selectedCountry: null,
        selectedArchetypeId: null,
        economicInputs: inputs,
        governmentComponents: loadedGovernmentComponents,
        taxSystemData,
        governmentStructure,
        completedSteps: ["foundation"],
        activeCoreTab: "identity",
        activeIdentitySubTab: "basic",
        activeGovernmentTab: "components",
        activeEconomicsTab: "components",
        showAdvancedMode: true,
        economyBuilderState: loadedEconomyBuilderState,
      }));
    }
  }, [
    mode,
    existingCountry,
    existingGovernment,
    existingTaxSystem,
    editorRelations,
    isLoadingCountry,
    setBuilderState,
  ]);

  // Load saved edits from localStorage after initial DB load
  useEffect(() => {
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

        const localSavedAt = savedLastSaved ? new Date(savedLastSaved).getTime() : 0;
        const dbUpdatedAt = (existingCountry as { updatedAt?: string | Date })?.updatedAt
          ? new Date((existingCountry as { updatedAt?: string | Date }).updatedAt!).getTime()
          : 0;
        const localIsNewer = localSavedAt > dbUpdatedAt;

        if (savedState && !localIsNewer) {
          safeRemoveItemSync(stateKey);
          safeRemoveItemSync(savedKey);
        } else if (savedState) {
          let parsedState: BuilderState;
          try {
            parsedState = JSON.parse(savedState);
          } catch {
            return;
          }
          if (parsedState.economicInputs && parsedState.economicInputs.countryName) {
            setBuilderState((prev): BuilderState => {
              const sanitizedSaved = sanitizeEconomicInputs(parsedState.economicInputs);
              if (!sanitizedSaved) return prev;

              const baseInputs: EconomicInputs = prev.economicInputs ?? createDefaultEconomicInputs();
              const baseIdentity = baseInputs.nationalIdentity;
              const savedIdentity = sanitizedSaved.nationalIdentity;

              const mergedInputs: EconomicInputs = {
                ...baseInputs,
                ...sanitizedSaved,
                countryName:
                  sanitizedSaved.countryName ||
                  baseInputs.countryName ||
                  parsedState.economicInputs?.countryName ||
                  "",
                flagUrl: sanitizedSaved.flagUrl || baseInputs.flagUrl || "",
                coatOfArmsUrl:
                  sanitizedSaved.coatOfArmsUrl || baseInputs.coatOfArmsUrl || "",
                nationalIdentity: {
                  ...baseIdentity,
                  ...savedIdentity,
                  countryName:
                    savedIdentity?.countryName ||
                    baseIdentity?.countryName ||
                    parsedState.economicInputs?.countryName ||
                    "",
                  officialName:
                    savedIdentity?.officialName || baseIdentity?.officialName || "",
                  governmentType:
                    savedIdentity?.governmentType ||
                    baseIdentity?.governmentType ||
                    "Republic",
                  motto: savedIdentity?.motto || baseIdentity?.motto || "",
                  mottoNative: savedIdentity?.mottoNative || baseIdentity?.mottoNative || "",
                  capitalCity: savedIdentity?.capitalCity || baseIdentity?.capitalCity || "",
                  largestCity: savedIdentity?.largestCity || baseIdentity?.largestCity || "",
                  demonym: savedIdentity?.demonym || baseIdentity?.demonym || "",
                  currency: savedIdentity?.currency || baseIdentity?.currency || "USD",
                  officialLanguages:
                    savedIdentity?.officialLanguages || baseIdentity?.officialLanguages || "",
                  nationalLanguage:
                    savedIdentity?.nationalLanguage || baseIdentity?.nationalLanguage || "",
                  nationalAnthem:
                    savedIdentity?.nationalAnthem || baseIdentity?.nationalAnthem || "",
                  nationalDay: savedIdentity?.nationalDay || baseIdentity?.nationalDay || "",
                  callingCode: savedIdentity?.callingCode || baseIdentity?.callingCode || "",
                  internetTLD: savedIdentity?.internetTLD || baseIdentity?.internetTLD || "",
                  drivingSide:
                    savedIdentity?.drivingSide === "left" || baseIdentity?.drivingSide === "left"
                      ? "left"
                      : "right",
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
                governmentStructure: parsedState.governmentStructure || prev.governmentStructure,
                taxSystemData: parsedState.taxSystemData || prev.taxSystemData,
                governmentComponents: parsedState.governmentComponents || prev.governmentComponents,
                economyBuilderState: parsedState.economyBuilderState || prev.economyBuilderState,
                activeCoreTab: parsedState.activeCoreTab || prev.activeCoreTab,
                activeIdentitySubTab: "basic",
                activeGovernmentTab: parsedState.activeGovernmentTab || prev.activeGovernmentTab,
                activeEconomicsTab: parsedState.activeEconomicsTab || prev.activeEconomicsTab,
                showAdvancedMode: true,
              };
            });
            setHasRestoredState(true);

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
        console.warn("[useBuilderEditMode] Failed to restore saved edits:", error);
      }
    }
  }, [
    mode,
    countryId,
    existingCountry,
    isLoadingCountry,
    notify,
    setBuilderState,
    setHasRestoredState,
    setLastSaved,
  ]);

  return {
    isLoadingCountry,
    existingCountry,
    existingGovernment,
    existingTaxSystem,
    editorRelations,
    editModeInitialized,
  };
}
