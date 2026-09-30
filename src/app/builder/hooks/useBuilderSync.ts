import { useEffect, useRef } from "react";
import { safeGetItemSync, safeRemoveItemSync } from "~/lib/system/local-storage-mutex";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { parseWikiNumericValue, normalizeGovernmentType } from "../lib/builder-parsers";
import { createDefaultEconomicInputs } from "../lib/economy-data-service";
import type { GovernmentType, DepartmentCategory } from "~/types/government";
import type { BuilderStep } from "../components/enhanced/builderConfig";
import type { ComponentType } from "~/lib/enums";
import type { BuilderState } from "./builderStateTypes";

interface UseBuilderSyncProps {
  mode: "create" | "edit";
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  setHasRestoredState: (restored: boolean) => void;
  setLastSaved: (date: Date | null) => void;
  localHadDataRef: React.MutableRefObject<boolean>;
}

interface WikiImportPayload {
  name?: string;
  population?: string | number | null;
  population_estimate?: string | number | null;
  population_census?: string | number | null;
  gdpPerCapita?: string | number | null;
  GDP_nominal_per_capita?: string | number | null;
  GDP_PPP_per_capita?: string | number | null;
  gdp_nominal?: string | number | null;
  GDP_nominal?: string | number | null;
  gdp_ppp?: string | number | null;
  GDP_PPP?: string | number | null;
  official_name?: string;
  conventional_long_name?: string;
  government_type?: string;
  motto?: string;
  national_motto?: string;
  demonym?: string;
  national_anthem?: string;
  religion?: string;
  capital?: string;
  largest_city?: string;
  currency?: string;
  currency_code?: string;
  languages?: string;
  calling_code?: string;
  internet_tld?: string;
  time_zone?: string;
  iso_code?: string;
  drives_on?: string;
  coordinates?: string | number;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  coat_of_arms?: string;
  head_of_state?: string;
  head_of_government?: string;
  legislature?: string;
  upper_house?: string;
  urbanization?: string | number;
  life_expectancy?: string | number;
  literacy_rate?: string | number;
  _importResult?: {
    selectedComponents?: ComponentType[];
    parsedDepartments?: Array<{
      name: string;
      category?: string;
      description?: string;
      minister?: string;
    }>;
  };
}

export function useBuilderSync({
  mode,
  setBuilderState,
  setHasRestoredState,
  setLastSaved,
  localHadDataRef,
}: UseBuilderSyncProps) {
  const quickStartProcessed = useRef(false);

  useEffect(() => {
    if (mode !== "create") return;

    try {
      const quickStartSection = safeGetItemSync("builder_quick_start_section");

      if (quickStartSection === "core" && !quickStartProcessed.current) {
        quickStartProcessed.current = true;

        setBuilderState((prev) => ({
          ...prev,
          creationOrigin: "scratch",
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
          const wikiData = JSON.parse(importedData) as WikiImportPayload;
          const inputs = createDefaultEconomicInputs();

          if (wikiData.name) inputs.countryName = wikiData.name;

          const popValue =
            wikiData.population ?? wikiData.population_estimate ?? wikiData.population_census;
          if (popValue) {
            const parsed = parseWikiNumericValue(popValue);
            if (parsed !== null) inputs.coreIndicators.totalPopulation = parsed;
          }

          const gdpPcValue =
            wikiData.gdpPerCapita ??
            wikiData.GDP_nominal_per_capita ??
            wikiData.GDP_PPP_per_capita;
          if (gdpPcValue) {
            const parsed = parseWikiNumericValue(gdpPcValue);
            if (parsed !== null) inputs.coreIndicators.gdpPerCapita = parsed;
          }

          const gdpNomValue =
            wikiData.gdp_nominal ?? wikiData.GDP_nominal ?? wikiData.gdp_ppp ?? wikiData.GDP_PPP;
          if (gdpNomValue !== undefined && gdpNomValue !== null) {
            const parsed = parseWikiNumericValue(gdpNomValue);
            if (parsed !== null) inputs.coreIndicators.nominalGDP = parsed;
          }
          if (
            !inputs.coreIndicators.nominalGDP &&
            inputs.coreIndicators.totalPopulation &&
            inputs.coreIndicators.gdpPerCapita
          ) {
            inputs.coreIndicators.nominalGDP =
              inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita;
          }

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
              nationalReligion: "",
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
              wikiData.official_name || wikiData.conventional_long_name || "";
          }
          if (wikiData.government_type) {
            inputs.nationalIdentity.governmentType = normalizeGovernmentType(
              wikiData.government_type
            );
          }
          if (wikiData.motto || wikiData.national_motto) {
            inputs.nationalIdentity.motto = wikiData.motto || wikiData.national_motto || "";
          }
          if (wikiData.demonym) inputs.nationalIdentity.demonym = wikiData.demonym;
          if (wikiData.national_anthem) {
            inputs.nationalIdentity.nationalAnthem = wikiData.national_anthem;
          }
          if (wikiData.religion) inputs.nationalIdentity.nationalReligion = wikiData.religion;
          if (wikiData.capital) inputs.nationalIdentity.capitalCity = wikiData.capital;
          if (wikiData.largest_city) inputs.nationalIdentity.largestCity = wikiData.largest_city;
          if (wikiData.currency) inputs.nationalIdentity.currency = wikiData.currency;
          if (wikiData.currency_code) {
            inputs.nationalIdentity.currencySymbol = wikiData.currency_code;
          }
          if (wikiData.languages) inputs.nationalIdentity.officialLanguages = wikiData.languages;
          if (wikiData.calling_code) inputs.nationalIdentity.callingCode = wikiData.calling_code;
          if (wikiData.internet_tld) inputs.nationalIdentity.internetTLD = wikiData.internet_tld;
          if (wikiData.time_zone) inputs.nationalIdentity.timeZone = wikiData.time_zone;
          if (wikiData.iso_code) inputs.nationalIdentity.isoCode = wikiData.iso_code;
          if (wikiData.drives_on) {
            inputs.nationalIdentity.drivingSide = wikiData.drives_on.toLowerCase().includes("left")
              ? "left"
              : "right";
          }

          if (wikiData.coordinates) {
            const coords = String(wikiData.coordinates);
            if (coords.includes("N") || coords.includes("S")) {
              inputs.nationalIdentity.coordinatesLatitude = coords.split(",")[0] || coords;
              inputs.nationalIdentity.coordinatesLongitude = coords.split(",")[1] || "";
            }
          }

          if (wikiData.flagUrl) inputs.flagUrl = normalizeFlagUrl(wikiData.flagUrl) || "";
          if (wikiData.coatOfArmsUrl || wikiData.coat_of_arms) {
            inputs.coatOfArmsUrl =
              normalizeFlagUrl(wikiData.coatOfArmsUrl || wikiData.coat_of_arms) || "";
          }

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

          const stateUpdate: Partial<BuilderState> = {
            creationOrigin: "import",
            step: "core",
            economicInputs: inputs,
            completedSteps: ["foundation"],
          };

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
                averageAnnualIncome: gdpPerCapCalc * 0.6,
                averageWorkweekHours: 40,
                averageOvertimeHours: 2,
                paidVacationDays: 20,
                paidSickLeaveDays: 10,
                parentalLeaveWeeks: 12,
                unionizationRate: 20,
                collectiveBargainingCoverage: 25,
                minimumWageHourly: Math.max((gdpPerCapCalc * 0.08) / 2000, 5),
                livingWageHourly: Math.max((gdpPerCapCalc * 0.1) / 2000, 8),
                workplaceSafetyIndex: 75,
                laborRightsScore: 70,
                workerProtections: {
                  jobSecurity: 70,
                  wageProtection: 75,
                  healthSafety: 80,
                  discriminationProtection: 75,
                  collectiveRights: 70,
                },
              },
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

          if (wikiData._importResult?.selectedComponents && wikiData._importResult.selectedComponents.length > 0) {
            stateUpdate.governmentComponents = wikiData._importResult.selectedComponents;
          }

          if (
            wikiData._importResult?.parsedDepartments &&
            wikiData._importResult.parsedDepartments.length > 0 &&
            stateUpdate.governmentStructure
          ) {
            const deptInputs = wikiData._importResult.parsedDepartments.map((d) => ({
              name: d.name,
              category: (d.category as DepartmentCategory) || "Other",
              description: d.description || `Government ${d.category?.toLowerCase() || ""} department`,
              minister: d.minister,
              ministerTitle: "Minister",
              headquarters: "",
              established: "",
              employeeCount: 0,
              icon: "",
              color: "#6366f1",
              priority: 50,
              organizationalLevel: "Ministry" as const,
              functions: [],
            }));
            stateUpdate.governmentStructure = {
              ...stateUpdate.governmentStructure,
              departments: deptInputs,
            };
          }

          setBuilderState((prev) => ({
            ...prev,
            ...stateUpdate,
          }));

          safeRemoveItemSync("builder_imported_data");
          return;
        } catch (parseError) {
          console.error("[useBuilderSync] Failed to parse wiki import data:", parseError);
        }
      }

      if (!quickStartProcessed.current) {
        let savedState = safeGetItemSync("builder_state");
        let savedLastSaved = safeGetItemSync("builder_last_saved");

        if (!savedState) {
          try {
            savedState = sessionStorage.getItem("builder_state");
            savedLastSaved = sessionStorage.getItem("builder_last_saved");
          } catch (error) {
            console.warn("[BuilderState] Failed to access sessionStorage:", error);
          }
        }

        if (savedState) {
          let parsedState: BuilderState;
          try {
            parsedState = JSON.parse(savedState);
          } catch {
            return;
          }
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
            localHadDataRef.current = true;
          }
        }

        if (savedLastSaved) {
          setLastSaved(new Date(savedLastSaved));
        }
      }
    } catch {
      // Failed to load saved state, continue with default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
}
