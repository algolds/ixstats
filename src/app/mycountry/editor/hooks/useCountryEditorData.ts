import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { createDefaultEconomicInputs, type EconomicInputs } from "~/app/builder/lib/economy-data-service";
import { type GovernmentBuilderState, type DepartmentInput, type BudgetAllocationInput, type RevenueSourceInput, type GovernmentType } from "~/types/government";

function calculatePopulationTier(population: number): string {
  if (population >= 1_000_000_000) return "Global Power";
  if (population >= 100_000_000) return "Major Nation";
  if (population >= 10_000_000) return "Regional Power";
  if (population >= 1_000_000) return "Mid-Sized";
  if (population >= 100_000) return "Small Nation";
  return "City-State";
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function useCountryEditorData() {
  const { user, isLoaded } = useUser();
  
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);
  const [realTimeValidation, setRealTimeValidation] = useState(true);
  const [activeTab, setActiveTab] = useState("core"); // Default tab
  const [originalInputs, setOriginalInputs] = useState<EconomicInputs | null>(null);
  const [governmentData, setGovernmentData] = useState<GovernmentBuilderState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [feedback, setFeedback] = useState<any>(null); // TODO: Define a proper type for feedback
  const [isCalculating, setIsCalculating] = useState(false);
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading, refetch: refetchCountry } = api.countries.getByIdAtTime.useQuery(
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
      console.log('useCountryEditorData - Initializing with country data:', country);
      
      const inputs = createDefaultEconomicInputs();
      console.log('useCountryEditorData - Default inputs created:', inputs.fiscalSystem);
      
      // Populate with LIVE country data (current values, not baseline)
      inputs.countryName = country.name;
      
      // Core indicators - use current live values with NaN protection
      const currentPop = Number((country as any).currentPopulation) || Number(country.baselinePopulation) || 10000000;
      const currentGdpPerCap = Number((country as any).currentGdpPerCapita) || Number(country.baselineGdpPerCapita) || 25000;
      const currentTotalGdp = Number((country as any).currentTotalGdp) || (currentPop * currentGdpPerCap);
      
      inputs.coreIndicators = {
        totalPopulation: !isNaN(currentPop) && currentPop > 0 ? currentPop : 10000000,
        gdpPerCapita: !isNaN(currentGdpPerCap) && currentGdpPerCap > 0 ? currentGdpPerCap : 25000,
        nominalGDP: !isNaN(currentTotalGdp) && currentTotalGdp > 0 ? currentTotalGdp : 250000000000,
        realGDPGrowthRate: 3.0,
        inflationRate: 2.0,
        currencyExchangeRate: 1.0,
      };
      
      // VALIDATE core indicators are never NaN
      if (isNaN(inputs.coreIndicators.totalPopulation)) inputs.coreIndicators.totalPopulation = 10000000;
      if (isNaN(inputs.coreIndicators.gdpPerCapita)) inputs.coreIndicators.gdpPerCapita = 25000;  
      if (isNaN(inputs.coreIndicators.nominalGDP)) inputs.coreIndicators.nominalGDP = inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita;
      
      // Labor & Employment - use live data
      if ((country as any).unemploymentRate !== undefined) {
        inputs.laborEmployment.unemploymentRate = (country as any).unemploymentRate;
      }
      if ((country as any).employmentRate !== undefined) {
        inputs.laborEmployment.laborForceParticipationRate = (country as any).laborForceParticipationRate || 65;
      }
      if ((country as any).averageAnnualIncome !== undefined) {
        inputs.laborEmployment.minimumWage = (country as any).averageAnnualIncome / 2080 || 15; // Estimate hourly from annual
      }
      
      // Fiscal system - FORCE valid numbers, no NaN allowed
      const countryTaxRevenue = Number((country as any).taxRevenueGDPPercent);
      const countryTotalDebt = Number((country as any).totalDebtGDPRatio);  
      const countryBudgetBalance = Number((country as any).budgetDeficitSurplus);
      const countryGovSpending = Number((country as any).governmentBudgetGDPPercent);
      
      // Always set valid values - use country data if valid, otherwise keep defaults
      inputs.fiscalSystem.taxRevenueGDPPercent = !isNaN(countryTaxRevenue) && countryTaxRevenue > 0 ? 
        countryTaxRevenue : inputs.fiscalSystem.taxRevenueGDPPercent;
        
      inputs.fiscalSystem.totalDebtGDPRatio = !isNaN(countryTotalDebt) && countryTotalDebt >= 0 ? 
        countryTotalDebt : inputs.fiscalSystem.totalDebtGDPRatio;
        
      inputs.fiscalSystem.budgetDeficitSurplus = !isNaN(countryBudgetBalance) ? 
        countryBudgetBalance : inputs.fiscalSystem.budgetDeficitSurplus;
        
      inputs.fiscalSystem.governmentBudgetGDPPercent = !isNaN(countryGovSpending) && countryGovSpending > 0 ? 
        countryGovSpending : inputs.fiscalSystem.governmentBudgetGDPPercent;
      
      // Recalculate government revenue total with valid data
      inputs.fiscalSystem.governmentRevenueTotal = 
        inputs.coreIndicators.nominalGDP * (inputs.fiscalSystem.taxRevenueGDPPercent / 100);
      
      // FINAL VALIDATION - Replace any remaining NaN with safe defaults
      if (isNaN(inputs.fiscalSystem.taxRevenueGDPPercent)) inputs.fiscalSystem.taxRevenueGDPPercent = 20;
      if (isNaN(inputs.fiscalSystem.governmentBudgetGDPPercent)) inputs.fiscalSystem.governmentBudgetGDPPercent = 25;
      if (isNaN(inputs.fiscalSystem.totalDebtGDPRatio)) inputs.fiscalSystem.totalDebtGDPRatio = 60;
      if (isNaN(inputs.fiscalSystem.budgetDeficitSurplus)) inputs.fiscalSystem.budgetDeficitSurplus = -inputs.coreIndicators.nominalGDP * 0.03;
      if (isNaN(inputs.fiscalSystem.governmentRevenueTotal)) inputs.fiscalSystem.governmentRevenueTotal = inputs.coreIndicators.nominalGDP * 0.20;
      if (isNaN(inputs.fiscalSystem.debtServiceCosts)) inputs.fiscalSystem.debtServiceCosts = inputs.coreIndicators.nominalGDP * 0.05;
      
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
      
      // Demographics - use live data
      if ((country as any).lifeExpectancy !== undefined) {
        inputs.demographics.lifeExpectancy = (country as any).lifeExpectancy;
      }
      if ((country as any).literacyRate !== undefined) {
        inputs.demographics.literacyRate = (country as any).literacyRate;
      }
      if ((country as any).urbanPopulationPercent !== undefined) {
        inputs.demographics.urbanRuralSplit = {
          urban: (country as any).urbanPopulationPercent,
          rural: 100 - (country as any).urbanPopulationPercent
        };
      }
      
      setEconomicInputs(inputs);
      setOriginalInputs(JSON.parse(JSON.stringify(inputs))); // Deep copy for comparison
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
              { label: "Errors", value: errors.filter(e => e.severity === 'error').length, trend: 'stable', status: 'danger' },
              { label: "Warnings", value: errors.filter(e => e.severity === 'warning').length, trend: 'stable', status: 'warning' },
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
        departments: existingGovernment.departments.map((dept: any) => ({
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
          functions: dept.functions || []
        })),
        budgetAllocations: existingGovernment.budgetAllocations.map((alloc: any) => ({
          departmentId: alloc.departmentId,
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
    
    // Fix any NaN values before setting
    if (isNaN(newInputs.fiscalSystem.taxRevenueGDPPercent)) {
      console.warn('handleInputsChange - fixing NaN taxRevenueGDPPercent');
      newInputs.fiscalSystem.taxRevenueGDPPercent = 20;
    }
    if (isNaN(newInputs.fiscalSystem.governmentBudgetGDPPercent)) {
      console.warn('handleInputsChange - fixing NaN governmentBudgetGDPPercent');
      newInputs.fiscalSystem.governmentBudgetGDPPercent = 25;
    }
    if (isNaN(newInputs.fiscalSystem.totalDebtGDPRatio)) {
      console.warn('handleInputsChange - fixing NaN totalDebtGDPRatio');
      newInputs.fiscalSystem.totalDebtGDPRatio = 60;
    }
    if (isNaN(newInputs.fiscalSystem.budgetDeficitSurplus)) {
      console.warn('handleInputsChange - fixing NaN budgetDeficitSurplus');
      newInputs.fiscalSystem.budgetDeficitSurplus = -newInputs.coreIndicators.nominalGDP * 0.03;
    }
    
    // Ensure governmentSpending.deficitSurplus is also valid
    if (isNaN(newInputs.governmentSpending.deficitSurplus)) {
      console.warn('handleInputsChange - fixing NaN governmentSpending.deficitSurplus');
      newInputs.governmentSpending.deficitSurplus = newInputs.fiscalSystem.budgetDeficitSurplus; // Sync with fiscal system
    }
    
    setEconomicInputs(newInputs);
    setHasChanges(true);
  };

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
    populationTier: economicInputs?.coreIndicators?.totalPopulation ? calculatePopulationTier(economicInputs.coreIndicators.totalPopulation) : 'Unknown' // Add populationTier
  };
}