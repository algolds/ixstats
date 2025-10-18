import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { createDefaultEconomicInputs, type EconomicInputs } from "~/app/builder/lib/economy-data-service";
import { type GovernmentBuilderState, type DepartmentInput, type BudgetAllocationInput, type RevenueSourceInput, type GovernmentType } from "~/types/government";
import { useUserCountry } from "~/hooks/useUserCountry";
import type { EditorFeedback, ValidationError } from "~/types/editor";

function calculatePopulationTier(population: number): string {
  if (population >= 1_000_000_000) return "Global Power";
  if (population >= 100_000_000) return "Major Nation";
  if (population >= 10_000_000) return "Regional Power";
  if (population >= 1_000_000) return "Mid-Sized";
  if (population >= 100_000) return "Small Nation";
  return "City-State";
}

export function useCountryEditorData() {
  const { user, isLoaded, userProfile, country, profileLoading, countryLoading } = useUserCountry();

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);
  const [realTimeValidation, setRealTimeValidation] = useState(true);
  const [activeTab, setActiveTab] = useState("core"); // Default tab
  const [originalInputs, setOriginalInputs] = useState<EconomicInputs | null>(null);
  const [governmentData, setGovernmentData] = useState<GovernmentBuilderState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [econSaveState, setEconSaveState] = useState<{ isSaving: boolean; lastSavedAt: Date | null; pendingChanges: boolean; error: Error | null }>({ isSaving: false, lastSavedAt: null, pendingChanges: false, error: null });
  const econDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get refetch function for country data
  const { refetch: refetchCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const updateCountryMutation = api.countries.updateEconomicData.useMutation();
  
  const { data: existingGovernment, isLoading: governmentLoading } = api.government.getByCountryId.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  
  const createGovernmentMutation = api.government.create.useMutation();
  const updateGovernmentMutation = api.government.update.useMutation();

  // Initialize economic inputs when country data loads with LIVE data
  useEffect(() => {
    if (country && !economicInputs) {
      console.log('=== useCountryEditorData - FULL COUNTRY DATA ===');
      console.log('Country name:', country.name);
      console.log('Has nationalIdentity?:', !!(country as any).nationalIdentity);
      console.log('Has calculatedStats?:', !!(country as any).calculatedStats);
      
      // Log the data structure to understand what we're getting
      const calculatedStats = (country as any).calculatedStats;
      console.log('calculatedStats object:', calculatedStats);
      console.log('baselinePopulation:', (country as any).baselinePopulation);
      console.log('baselineGdpPerCapita:', (country as any).baselineGdpPerCapita);
      console.log('currentPopulation (direct):', (country as any).currentPopulation);
      console.log('currentGdpPerCapita (direct):', (country as any).currentGdpPerCapita);
      console.log('calculatedStats.currentPopulation:', calculatedStats?.currentPopulation);
      console.log('calculatedStats.currentGdpPerCapita:', calculatedStats?.currentGdpPerCapita);
      console.log('calculatedStats.currentTotalGdp:', calculatedStats?.currentTotalGdp);

      const inputs = createDefaultEconomicInputs();
      console.log('useCountryEditorData - Default inputs created:', inputs.fiscalSystem);
      
      // Populate with LIVE country data (current values, not baseline)
      inputs.countryName = country.name;

      // FIXED: Access current values from calculatedStats (returned by getByIdAtTime)
      // The query returns: { ...fields, calculatedStats: { currentPopulation, currentGdpPerCapita, currentTotalGdp } }
      // NO DEFAULTS - Show actual data or 0 if missing (makes missing data obvious in prod)
      const currentPop = Number(calculatedStats?.currentPopulation) || Number((country as any).baselinePopulation) || 0;
      const currentGdpPerCap = Number(calculatedStats?.currentGdpPerCapita) || Number((country as any).baselineGdpPerCapita) || 0;
      const currentTotalGdp = Number(calculatedStats?.currentTotalGdp) || 0;
      
      console.log('FINAL VALUES TO USE (0 means missing data):');
      console.log('currentPop:', currentPop);
      console.log('currentGdpPerCap:', currentGdpPerCap);
      console.log('currentTotalGdp:', currentTotalGdp);

      inputs.coreIndicators = {
        totalPopulation: !isNaN(currentPop) ? currentPop : 0,
        gdpPerCapita: !isNaN(currentGdpPerCap) ? currentGdpPerCap : 0,
        nominalGDP: !isNaN(currentTotalGdp) ? currentTotalGdp : 0,
        realGDPGrowthRate: (country as any).realGDPGrowthRate ?? 0,
        inflationRate: (country as any).inflationRate ?? 0,
        currencyExchangeRate: (country as any).currencyExchangeRate ?? 1.0,
      };

      // VALIDATE core indicators are never NaN (convert to 0 to make missing data obvious)
      if (isNaN(inputs.coreIndicators.totalPopulation)) inputs.coreIndicators.totalPopulation = 0;
      if (isNaN(inputs.coreIndicators.gdpPerCapita)) inputs.coreIndicators.gdpPerCapita = 0;
      if (isNaN(inputs.coreIndicators.nominalGDP)) inputs.coreIndicators.nominalGDP = 0;
      
      // Labor & Employment - use database values or 0 if missing (no fake placeholders)
      inputs.laborEmployment.unemploymentRate = (country as any).unemploymentRate ?? 0;
      inputs.laborEmployment.laborForceParticipationRate = (country as any).laborForceParticipationRate ?? 0;
      inputs.laborEmployment.employmentRate = (country as any).employmentRate ?? 0;
      inputs.laborEmployment.totalWorkforce = (country as any).totalWorkforce ?? 0;
      inputs.laborEmployment.averageWorkweekHours = (country as any).averageWorkweekHours ?? 0;
      inputs.laborEmployment.minimumWage = (country as any).minimumWage ?? 0;
      inputs.laborEmployment.averageAnnualIncome = (country as any).averageAnnualIncome ?? 0;

      // Fiscal system - use database values or 0 if missing (no fake placeholders)
      inputs.fiscalSystem.taxRevenueGDPPercent = (country as any).taxRevenueGDPPercent ?? 0;
      inputs.fiscalSystem.governmentRevenueTotal = (country as any).governmentRevenueTotal ?? 0;
      inputs.fiscalSystem.totalDebtGDPRatio = (country as any).totalDebtGDPRatio ?? 0;
      inputs.fiscalSystem.budgetDeficitSurplus = (country as any).budgetDeficitSurplus ?? 0;
      inputs.fiscalSystem.governmentBudgetGDPPercent = (country as any).governmentBudgetGDPPercent ?? 0;
      inputs.fiscalSystem.internalDebtGDPPercent = (country as any).internalDebtGDPPercent ?? 0;
      inputs.fiscalSystem.externalDebtGDPPercent = (country as any).externalDebtGDPPercent ?? 0;
      inputs.fiscalSystem.interestRates = (country as any).interestRates ?? 0;
      inputs.fiscalSystem.debtServiceCosts = (country as any).debtServiceCosts ?? 0;
      
      // Recalculate government revenue total with valid data
      inputs.fiscalSystem.governmentRevenueTotal = 
        inputs.coreIndicators.nominalGDP * (inputs.fiscalSystem.taxRevenueGDPPercent / 100);
      
      // FINAL VALIDATION - Replace any remaining NaN with 0 (no fake defaults in prod)
      if (isNaN(inputs.fiscalSystem.taxRevenueGDPPercent)) inputs.fiscalSystem.taxRevenueGDPPercent = 0;
      if (isNaN(inputs.fiscalSystem.governmentBudgetGDPPercent)) inputs.fiscalSystem.governmentBudgetGDPPercent = 0;
      if (isNaN(inputs.fiscalSystem.totalDebtGDPRatio)) inputs.fiscalSystem.totalDebtGDPRatio = 0;
      if (isNaN(inputs.fiscalSystem.budgetDeficitSurplus)) inputs.fiscalSystem.budgetDeficitSurplus = 0;
      if (isNaN(inputs.fiscalSystem.governmentRevenueTotal)) inputs.fiscalSystem.governmentRevenueTotal = 0;
      if (isNaN(inputs.fiscalSystem.debtServiceCosts)) inputs.fiscalSystem.debtServiceCosts = 0;
      
      console.log('useCountryEditorData - GUARANTEED VALID fiscal system:', inputs.fiscalSystem);
      
      // SUPER AGGRESSIVE VALIDATION - Log every single value
      console.log('FISCAL VALIDATION CHECK:', {
        taxRevenueGDPPercent: inputs.fiscalSystem.taxRevenueGDPPercent,
        isNaN_taxRevenue: isNaN(inputs.fiscalSystem.taxRevenueGDPPercent),
        governmentBudgetGDPPercent: inputs.fiscalSystem.governmentBudgetGDPPercent,
        isNaN_govBudget: isNaN(inputs.fiscalSystem.governmentBudgetGDPPercent),
        totalDebtGDPRatio: inputs.fiscalSystem.totalDebtGDPRatio,
        isNaN_debt: isNaN(inputs.fiscalSystem.totalDebtGDPRatio),
        budgetDeficitSurplus: inputs.fiscalSystem.budgetDeficitSurplus,
        isNaN_deficit: isNaN(inputs.fiscalSystem.budgetDeficitSurplus),
        nominalGDP: inputs.coreIndicators.nominalGDP,
        isNaN_gdp: isNaN(inputs.coreIndicators.nominalGDP)
      });
      
      // Demographics - use database values or 0 if missing (no fake placeholders)
      inputs.demographics.lifeExpectancy = (country as any).lifeExpectancy ?? 0;
      inputs.demographics.literacyRate = (country as any).literacyRate ?? 0;
      if ((country as any).urbanPopulationPercent !== undefined && (country as any).urbanPopulationPercent !== null) {
        inputs.demographics.urbanRuralSplit = {
          urban: (country as any).urbanPopulationPercent,
          rural: 100 - (country as any).urbanPopulationPercent
        };
      } else {
        inputs.demographics.urbanRuralSplit = {
          urban: 0,
          rural: 0
        };
      }

      // Income & Wealth Distribution - use database values or 0 if missing (no fake placeholders)
      inputs.incomeWealth.povertyRate = (country as any).povertyRate ?? 0;
      inputs.incomeWealth.incomeInequalityGini = (country as any).incomeInequalityGini ?? 0;
      inputs.incomeWealth.socialMobilityIndex = (country as any).socialMobilityIndex ?? 0;

      // Government Spending - use database values or 0 if missing (no fake placeholders)
      inputs.governmentSpending.totalSpending = (country as any).totalGovernmentSpending ?? 0;
      inputs.governmentSpending.spendingGDPPercent = (country as any).spendingGDPPercent ?? 0;
      inputs.governmentSpending.spendingPerCapita = (country as any).spendingPerCapita ?? 0;
      inputs.governmentSpending.deficitSurplus = (country as any).budgetDeficitSurplus ?? 0;

      // National Identity - populate from saved nationalIdentity relation or country fields
      const nationalIdentity = (country as any).nationalIdentity;
      console.log('useCountryEditorData - Loading nationalIdentity:', nationalIdentity);
      console.log('useCountryEditorData - Country data:', {
        name: country.name,
        governmentType: country.governmentType,
        capital: nationalIdentity?.capitalCity,
        religion: (country as any).religion
      });

      inputs.nationalIdentity = {
        countryName: nationalIdentity?.countryName || country.name || '',
        officialName: nationalIdentity?.officialName || '',
        governmentType: nationalIdentity?.governmentType || country.governmentType || 'republic',
        motto: nationalIdentity?.motto || '',
        mottoNative: nationalIdentity?.mottoNative || '',
        capitalCity: nationalIdentity?.capitalCity || '',
        largestCity: nationalIdentity?.largestCity || '',
        demonym: nationalIdentity?.demonym || '',
        currency: nationalIdentity?.currency || (country as any).currencyName || '',
        currencySymbol: nationalIdentity?.currencySymbol || (country as any).currencySymbol || '$',
        officialLanguages: nationalIdentity?.officialLanguages || '',
        nationalLanguage: nationalIdentity?.nationalLanguage || '',
        nationalAnthem: nationalIdentity?.nationalAnthem || '',
        nationalReligion: (country as any).religion || '',
        nationalDay: nationalIdentity?.nationalDay || '',
        callingCode: nationalIdentity?.callingCode || '',
        internetTLD: nationalIdentity?.internetTLD || '',
        drivingSide: nationalIdentity?.drivingSide || 'right',
        timeZone: nationalIdentity?.timeZone || '',
        isoCode: nationalIdentity?.isoCode || (country as any).countryCode || '',
        coordinatesLatitude: nationalIdentity?.coordinatesLatitude || '',
        coordinatesLongitude: nationalIdentity?.coordinatesLongitude || '',
        emergencyNumber: nationalIdentity?.emergencyNumber || '',
        postalCodeFormat: nationalIdentity?.postalCodeFormat || '',
        nationalSport: nationalIdentity?.nationalSport || '',
        weekStartDay: nationalIdentity?.weekStartDay || 'monday'
      };

      // Flag and Coat of Arms URLs (these are in nationalIdentity now)
      inputs.flagUrl = nationalIdentity?.flagUrl || '';
      inputs.coatOfArmsUrl = nationalIdentity?.coatOfArmsUrl || '';

      // Geography - populate from saved country data
      inputs.geography = {
        continent: country.continent || '',
        region: country.region || ''
      };

      console.log('=== FINAL INPUTS BEING SET ===');
      console.log('inputs.nationalIdentity:', inputs.nationalIdentity);
      console.log('inputs.geography:', inputs.geography);

      setEconomicInputs(inputs);
      setOriginalInputs(JSON.parse(JSON.stringify(inputs))); // Deep copy for comparison

      console.log('=== economicInputs state has been set ===');
    }
  }, [country, economicInputs]);

  // Calculate feedback based on economic inputs and errors
  useEffect(() => {
    if (economicInputs && errors) {
      // This is a placeholder for actual feedback calculation logic
      // In a real application, this would involve more complex logic
      // based on economicInputs and errors to generate meaningful feedback.
      const newFeedback = {
        sections: [
          {
            title: "Economic Health",
            metrics: [
              { label: "Errors", value: errors.filter(e => e.severity === 'error').length, trend: 'stable' as const, status: 'danger' as const },
              { label: "Warnings", value: errors.filter(e => e.severity === 'warning').length, trend: 'stable' as const, status: 'warning' as const },
            ],
          },
        ],
        overallScore: 100 - (errors.filter(e => e.severity === 'error').length * 10) - (errors.filter(e => e.severity === 'warning').length * 5),
        recommendations: errors.map(e => e.message),
      };
      setFeedback(newFeedback);
    }
  }, [economicInputs, errors]);

  useEffect(() => {
    if (country && 'flag' in country && country.flag) { // Type-safe check for flag property
      setFlagUrl(country.flag as string);
    } else {
      setFlagUrl(null); // Or a placeholder URL
    }
  }, [country]);

  // Initialize government data when it loads
  useEffect(() => {
    if (existingGovernment && !governmentData && country) {
      // Build helper map from DB department id -> index string for builder expectations
      // The builder uses index-based ids ("0", "1", ...) for allocations/relations
      const departmentIdToIndex = new Map<string, string>(
        (existingGovernment.departments as any[]).map((d: any, idx: number) => [d.id, idx.toString()])
      );

      // Convert existing government data to builder format
      const builderData: GovernmentBuilderState = {
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
          budgetCurrency: existingGovernment.budgetCurrency
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
          // Prisma stores functions as a JSON string; coerce to string[] safely
          functions: Array.isArray(dept.functions)
            ? (dept.functions as string[])
            : (typeof dept.functions === 'string'
              ? (() => { try { const parsed = JSON.parse(dept.functions as string); return Array.isArray(parsed) ? parsed as string[] : []; } catch { return []; } })()
              : [])
        })),
        budgetAllocations: (existingGovernment.budgetAllocations as any[]).map((alloc: any) => ({
          // Map DB department id to index-based id expected by the builder
          departmentId: departmentIdToIndex.get(alloc.departmentId) ?? '0',
          budgetYear: alloc.budgetYear,
          allocatedAmount: alloc.allocatedAmount,
          allocatedPercent: alloc.allocatedPercent,
          notes: alloc.notes ?? undefined
        })),
        revenueSources: existingGovernment.revenueSources.map((rev: any) => ({
          name: rev.name,
          category: rev.category,
          description: rev.description ?? undefined,
          rate: rev.rate ?? undefined,
          revenueAmount: rev.revenueAmount,
          collectionMethod: rev.collectionMethod ?? undefined,
          administeredBy: rev.administeredBy ?? undefined
        })),
        isValid: true,
        errors: { structure: [], departments: {}, budget: [], revenue: [] }
      };
      
      setGovernmentData(builderData);
    } else if (!existingGovernment && !governmentData && country && economicInputs) {
      // Initialize empty government data
      const emptyData: GovernmentBuilderState = {
        structure: {
          governmentName: `Government of ${country.name}`,
          governmentType: 'Constitutional Monarchy',
          totalBudget: economicInputs.coreIndicators.nominalGDP * 0.35,
          fiscalYear: 'Calendar Year',
          budgetCurrency: 'USD'
        },
        departments: [],
        budgetAllocations: [],
        revenueSources: [],
        isValid: false,
        errors: { structure: [], departments: {}, budget: [], revenue: [] }
      };
      
      setGovernmentData(emptyData);
    }
  }, [existingGovernment, governmentData, country, economicInputs]);

  const handleInputsChange = (newInputs: EconomicInputs) => {
    if (!newInputs || !newInputs.coreIndicators || !newInputs.laborEmployment || !newInputs.fiscalSystem || !newInputs.governmentSpending || !newInputs.demographics) {
      console.error('Invalid economicInputs structure:', newInputs);
      return;
    }
    
    // VALIDATE that fiscal system values are not NaN before setting
    console.log('handleInputsChange - incoming fiscal data:', newInputs.fiscalSystem);
    
    // Fix any NaN values before setting (use 0 to make missing data obvious)
    if (isNaN(newInputs.fiscalSystem.taxRevenueGDPPercent)) {
      console.warn('handleInputsChange - fixing NaN taxRevenueGDPPercent');
      newInputs.fiscalSystem.taxRevenueGDPPercent = 0;
    }
    if (isNaN(newInputs.fiscalSystem.governmentBudgetGDPPercent)) {
      console.warn('handleInputsChange - fixing NaN governmentBudgetGDPPercent');
      newInputs.fiscalSystem.governmentBudgetGDPPercent = 0;
    }
    if (isNaN(newInputs.fiscalSystem.totalDebtGDPRatio)) {
      console.warn('handleInputsChange - fixing NaN totalDebtGDPRatio');
      newInputs.fiscalSystem.totalDebtGDPRatio = 0;
    }
    if (isNaN(newInputs.fiscalSystem.budgetDeficitSurplus)) {
      console.warn('handleInputsChange - fixing NaN budgetDeficitSurplus');
      newInputs.fiscalSystem.budgetDeficitSurplus = 0;
    }
    
    // Ensure governmentSpending.deficitSurplus is also valid
    if (isNaN(newInputs.governmentSpending.deficitSurplus)) {
      console.warn('handleInputsChange - fixing NaN governmentSpending.deficitSurplus');
      newInputs.governmentSpending.deficitSurplus = 0;
    }
    
    setEconomicInputs(newInputs);
    setHasChanges(true);
  };

  // Debounced autosave for economic/demographic inputs
  useEffect(() => {
    if (!economicInputs || !originalInputs || !country?.id) return;

    // Determine if any autosave-relevant sections changed
    const changed =
      JSON.stringify(economicInputs.laborEmployment) !== JSON.stringify(originalInputs.laborEmployment) ||
      JSON.stringify(economicInputs.fiscalSystem) !== JSON.stringify(originalInputs.fiscalSystem) ||
      JSON.stringify(economicInputs.demographics) !== JSON.stringify(originalInputs.demographics) ||
      JSON.stringify(economicInputs.incomeWealth) !== JSON.stringify(originalInputs.incomeWealth) ||
      JSON.stringify(economicInputs.governmentSpending) !== JSON.stringify(originalInputs.governmentSpending) ||
      economicInputs.coreIndicators.realGDPGrowthRate !== originalInputs.coreIndicators.realGDPGrowthRate ||
      economicInputs.coreIndicators.inflationRate !== originalInputs.coreIndicators.inflationRate ||
      economicInputs.coreIndicators.currencyExchangeRate !== originalInputs.coreIndicators.currencyExchangeRate;

    if (!changed) return;

    setEconSaveState(prev => ({ ...prev, pendingChanges: true }));

    if (econDebounceRef.current) {
      clearTimeout(econDebounceRef.current);
    }

    econDebounceRef.current = setTimeout(async () => {
      try {
        setEconSaveState(prev => ({ ...prev, isSaving: true, error: null }));

        const economicData = {
          nominalGDP: economicInputs.coreIndicators.nominalGDP,
          realGDPGrowthRate: economicInputs.coreIndicators.realGDPGrowthRate,
          inflationRate: economicInputs.coreIndicators.inflationRate,
          currencyExchangeRate: economicInputs.coreIndicators.currencyExchangeRate ?? 1.0,

          laborForceParticipationRate: economicInputs.laborEmployment.laborForceParticipationRate,
          employmentRate: 100 - economicInputs.laborEmployment.unemploymentRate,
          unemploymentRate: economicInputs.laborEmployment.unemploymentRate,
          totalWorkforce: Math.round(economicInputs.coreIndicators.totalPopulation * (economicInputs.laborEmployment.laborForceParticipationRate / 100)),
          averageWorkweekHours: economicInputs.laborEmployment.averageWorkweekHours,
          minimumWage: economicInputs.laborEmployment.minimumWage,
          averageAnnualIncome: (economicInputs.laborEmployment.minimumWage || 15) * (economicInputs.laborEmployment.averageWorkweekHours || 40) * 52,

          taxRevenueGDPPercent: economicInputs.fiscalSystem.taxRevenueGDPPercent,
          governmentRevenueTotal: economicInputs.fiscalSystem.governmentRevenueTotal,
          taxRevenuePerCapita: economicInputs.coreIndicators.totalPopulation > 0 ? (economicInputs.fiscalSystem.governmentRevenueTotal / economicInputs.coreIndicators.totalPopulation) : 0,
          governmentBudgetGDPPercent: economicInputs.fiscalSystem.governmentBudgetGDPPercent,
          budgetDeficitSurplus: economicInputs.fiscalSystem.budgetDeficitSurplus,
          internalDebtGDPPercent: economicInputs.fiscalSystem.internalDebtGDPPercent,
          externalDebtGDPPercent: economicInputs.fiscalSystem.externalDebtGDPPercent,
          totalDebtGDPRatio: economicInputs.fiscalSystem.totalDebtGDPRatio,
          debtPerCapita: economicInputs.coreIndicators.totalPopulation > 0 ? ((economicInputs.fiscalSystem.totalDebtGDPRatio / 100) * economicInputs.coreIndicators.nominalGDP / economicInputs.coreIndicators.totalPopulation) : 0,
          interestRates: economicInputs.fiscalSystem.interestRates,
          debtServiceCosts: economicInputs.fiscalSystem.debtServiceCosts,

          povertyRate: economicInputs.incomeWealth.povertyRate,
          incomeInequalityGini: economicInputs.incomeWealth.incomeInequalityGini,
          socialMobilityIndex: economicInputs.incomeWealth.socialMobilityIndex,

          totalGovernmentSpending: economicInputs.governmentSpending.totalSpending,
          spendingGDPPercent: economicInputs.coreIndicators.nominalGDP > 0 ? ((economicInputs.governmentSpending.totalSpending / economicInputs.coreIndicators.nominalGDP) * 100) : 0,
          spendingPerCapita: economicInputs.coreIndicators.totalPopulation > 0 ? (economicInputs.governmentSpending.totalSpending / economicInputs.coreIndicators.totalPopulation) : 0,

          lifeExpectancy: economicInputs.demographics.lifeExpectancy,
          urbanPopulationPercent: economicInputs.demographics.urbanRuralSplit?.urban || 50,
          ruralPopulationPercent: economicInputs.demographics.urbanRuralSplit?.rural || 50,
          literacyRate: economicInputs.demographics.literacyRate,
        };

        await updateCountryMutation.mutateAsync({
          countryId: country.id,
          economicData,
        });

        // Update original inputs to current so subsequent changes are detected accurately
        setOriginalInputs(JSON.parse(JSON.stringify(economicInputs)));
        setEconSaveState({ isSaving: false, lastSavedAt: new Date(), pendingChanges: false, error: null });
      } catch (err) {
        setEconSaveState(prev => ({ ...prev, isSaving: false, error: err instanceof Error ? err : new Error('Autosave failed') }));
      }
    }, 2000);

    return () => {
      if (econDebounceRef.current) {
        clearTimeout(econDebounceRef.current);
      }
    };
  }, [economicInputs, originalInputs, country, updateCountryMutation]);

  const validateInputs = (inputs: EconomicInputs) => {
    const newErrors: ValidationError[] = [];
    
    if (!inputs.countryName.trim()) {
      newErrors.push({ field: 'countryName', message: 'Country name is required', severity: 'error' });
    }
    if (inputs.coreIndicators.totalPopulation <= 0) {
      newErrors.push({ field: 'totalPopulation', message: 'Population must be greater than 0', severity: 'error' });
    }
    if (inputs.coreIndicators.gdpPerCapita <= 0) {
      newErrors.push({ field: 'gdpPerCapita', message: 'GDP per capita must be greater than 0', severity: 'error' });
    }
    
    if (realTimeValidation) {
      if (inputs.fiscalSystem.budgetDeficitSurplus < -inputs.coreIndicators.nominalGDP * 0.2) {
        newErrors.push({ field: 'budgetDeficit', message: 'Large budget deficit may impact stability', severity: 'warning' });
      }
    }
    
    setErrors(newErrors);
  };

  const handleSave = async () => {
    if (errors.some(e => e.severity === 'error') || !economicInputs) {
      return;
    }

    setIsSaving(true);
    try {
      const economicData = {
        nominalGDP: economicInputs.coreIndicators.nominalGDP,
        realGDPGrowthRate: economicInputs.coreIndicators.realGDPGrowthRate,
        inflationRate: economicInputs.coreIndicators.inflationRate,
        currencyExchangeRate: 1.0,

        laborForceParticipationRate: economicInputs.laborEmployment.laborForceParticipationRate,
        employmentRate: 100 - economicInputs.laborEmployment.unemploymentRate,
        unemploymentRate: economicInputs.laborEmployment.unemploymentRate,
        totalWorkforce: Math.round(economicInputs.coreIndicators.totalPopulation * (economicInputs.laborEmployment.laborForceParticipationRate / 100)),
        averageWorkweekHours: economicInputs.laborEmployment.averageWorkweekHours,
        minimumWage: economicInputs.laborEmployment.minimumWage,
        averageAnnualIncome: (economicInputs.laborEmployment.minimumWage || 15) * (economicInputs.laborEmployment.averageWorkweekHours || 40) * 52,

        taxRevenueGDPPercent: economicInputs.fiscalSystem.taxRevenueGDPPercent,
        governmentRevenueTotal: economicInputs.fiscalSystem.governmentRevenueTotal,
        taxRevenuePerCapita: economicInputs.fiscalSystem.governmentRevenueTotal / economicInputs.coreIndicators.totalPopulation,
        governmentBudgetGDPPercent: economicInputs.fiscalSystem.governmentBudgetGDPPercent,
        budgetDeficitSurplus: economicInputs.fiscalSystem.budgetDeficitSurplus,
        internalDebtGDPPercent: economicInputs.fiscalSystem.internalDebtGDPPercent,
        externalDebtGDPPercent: economicInputs.fiscalSystem.externalDebtGDPPercent,
        totalDebtGDPRatio: economicInputs.fiscalSystem.totalDebtGDPRatio,
        debtPerCapita: (economicInputs.fiscalSystem.totalDebtGDPRatio / 100) * economicInputs.coreIndicators.nominalGDP / economicInputs.coreIndicators.totalPopulation,
        interestRates: economicInputs.fiscalSystem.interestRates,
        debtServiceCosts: economicInputs.fiscalSystem.debtServiceCosts,

        povertyRate: economicInputs.incomeWealth.povertyRate,
        incomeInequalityGini: economicInputs.incomeWealth.incomeInequalityGini,
        socialMobilityIndex: economicInputs.incomeWealth.socialMobilityIndex,

        totalGovernmentSpending: economicInputs.governmentSpending.totalSpending,
        spendingGDPPercent: (economicInputs.governmentSpending.totalSpending / economicInputs.coreIndicators.nominalGDP) * 100,
        spendingPerCapita: economicInputs.governmentSpending.totalSpending / economicInputs.coreIndicators.totalPopulation,

        lifeExpectancy: economicInputs.demographics.lifeExpectancy,
        urbanPopulationPercent: economicInputs.demographics.urbanRuralSplit?.urban || 50,
        ruralPopulationPercent: economicInputs.demographics.urbanRuralSplit?.rural || 50,
        literacyRate: economicInputs.demographics.literacyRate,
      };

      if (country?.id) {
        await updateCountryMutation.mutateAsync({
          countryId: country.id,
          economicData
        });
      }
      
      setHasChanges(false);
      await refetchCountry();
    } catch (error) {
      console.error('Failed to save country data:', error);
      alert('Failed to save country data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (country) {
      const inputs = createDefaultEconomicInputs();
      inputs.countryName = country.name;
      setEconomicInputs(inputs);
      setHasChanges(false);
      setErrors([]);
    }
  };

  const handleGovernmentSave = async (data: GovernmentBuilderState) => {
    if (!userProfile?.countryId || !country) return;

    setIsSaving(true);
    try {
      if (existingGovernment) {
        await updateGovernmentMutation.mutateAsync({
          countryId: userProfile.countryId,
          data
        });
      } else {
        await createGovernmentMutation.mutateAsync({
          countryId: userProfile.countryId,
          data
        });
      }
      
      setGovernmentData(data);
      setHasChanges(false);
      
      if (economicInputs) {
        const updatedInputs = {
          ...economicInputs,
          governmentSpending: {
            ...economicInputs.governmentSpending,
            totalSpending: data.structure.totalBudget,
            spendingGDPPercent: economicInputs.coreIndicators.nominalGDP > 0 
              ? (data.structure.totalBudget / economicInputs.coreIndicators.nominalGDP) * 100 
              : 35,
            spendingCategories: data.departments.map((dept, index) => {
              const allocation = data.budgetAllocations.find(a => a.departmentId === index.toString());
              return {
                category: dept.name,
                amount: allocation?.allocatedAmount || 0,
                percent: allocation?.allocatedPercent || 0,
                icon: dept.icon,
                color: dept.color,
                description: dept.description
              };
            }),
            deficitSurplus: economicInputs.fiscalSystem.budgetDeficitSurplus,
          }
        };
        setEconomicInputs(updatedInputs);
      }
      
    } catch (error) {
      console.error('Failed to save government structure:', error);
      alert('Failed to save government structure. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return {
    user, isLoaded, activeTab, setActiveTab, hasChanges, setHasChanges, isSaving, setIsSaving,
    errors, setErrors, economicInputs, setEconomicInputs, realTimeValidation, setRealTimeValidation,
    originalInputs, setOriginalInputs, governmentData, setGovernmentData, showAdvanced, setShowAdvanced,
    feedback, isCalculating, userProfile, profileLoading, country, countryLoading, refetchCountry, flagUrl,
    updateCountryMutation, existingGovernment, governmentLoading, createGovernmentMutation, updateGovernmentMutation,
    handleInputsChange, validateInputs, handleSave, handleReset, handleGovernmentSave, errorCount, warningCount,
    econSaveState,
    populationTier: economicInputs?.coreIndicators?.totalPopulation ? calculatePopulationTier(economicInputs.coreIndicators.totalPopulation) : 'Unknown' // Add populationTier
  };
}