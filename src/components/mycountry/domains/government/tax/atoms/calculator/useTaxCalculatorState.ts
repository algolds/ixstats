import { useState, useMemo, useEffect, useRef } from "react";
import type {
  TaxSystem,
  TaxCategory,
  TaxBracket,
  TaxExemption,
  TaxDeduction,
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxDeductionAmount,
  TaxExemptionAmount,
} from "~/types/tax-system";
import type { CoreEconomicIndicatorsData } from "~/types/economics";
import type { GovernmentBuilderState } from "~/types/government";
import { TaxCalculatorEngine } from "~/lib/economy/tax-calculator";
import { ComponentType } from "~/lib/enums";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { calculateUnifiedAtomicModifiers } from "~/lib/builder";
import { api } from "~/trpc/react";

export interface UseTaxCalculatorStateProps {
  taxSystem: TaxSystem;
  categories: TaxCategory[];
  brackets: TaxBracket[];
  exemptions: TaxExemption[];
  deductions: TaxDeduction[];
  onCalculationChange?: (result: TaxCalculationResult | null) => void;
  economicData?: CoreEconomicIndicatorsData;
  governmentData?: GovernmentBuilderState;
  calculationMode?: "individual" | "corporate" | "both";
  governmentComponents?: ComponentType[];
  economicComponents?: EconomicComponentType[];
  sectorData?: {
    id: string;
    name: string;
    gdpContribution: number;
    taxRate?: number;
  }[];
  countryId?: string;
  enableLiveCalculation?: boolean;
}

export function useTaxCalculatorState({
  taxSystem,
  categories,
  brackets,
  exemptions,
  deductions,
  onCalculationChange,
  economicData,
  governmentData,
  calculationMode: initialCalculationMode = "individual",
  governmentComponents = [],
  economicComponents = [],
  sectorData = [],
  countryId,
  enableLiveCalculation = false,
}: UseTaxCalculatorStateProps) {
  const [income, setIncome] = useState<string>("100000");
  const [corporateIncome, setCorporateIncome] = useState<string>("500000");
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [selectedDeductions, setSelectedDeductions] = useState<TaxDeductionAmount[]>([]);
  const [selectedExemptions, setSelectedExemptions] = useState<TaxExemptionAmount[]>([]);
  const [selectedCorporateDeductions, setSelectedCorporateDeductions] = useState<
    TaxDeductionAmount[]
  >([]);
  const [selectedCorporateExemptions, setSelectedCorporateExemptions] = useState<
    TaxExemptionAmount[]
  >([]);
  const [activeTab, setActiveTab] = useState<"calculator" | "breakdown" | "suggestions">(
    "calculator"
  );
  const [calculatorMode, setCalculatorMode] = useState<"individual" | "corporate" | "both">(
    initialCalculationMode
  );
  const [calculationTimestamp, setCalculationTimestamp] = useState<string | null>(null);
  const [liveCalculationResult, setLiveCalculationResult] = useState<any>(null);

  const liveTaxCalculation = api.taxSystem.calculateLiveTax.useMutation({
    onSuccess: (data) => {
      setLiveCalculationResult(data);
      setCalculationTimestamp(data.timestamp);
      if (onCalculationChange) {
        onCalculationChange(data as any);
      }
    },
    onError: (error) => {
      console.error("Live tax calculation error:", error);
    },
  });

  const calculatorEngine = useMemo(() => {
    return new TaxCalculatorEngine(taxSystem, categories, brackets, exemptions, deductions);
  }, [taxSystem, categories, brackets, exemptions, deductions]);

  useEffect(() => {
    if (!enableLiveCalculation || !countryId) return;

    const incomeValue = parseFloat(income);
    if (!incomeValue || incomeValue <= 0) return;

    const timer = setTimeout(() => {
      liveTaxCalculation.mutate({
        taxSystemId: taxSystem.id,
        countryId,
        income: incomeValue,
        corporateIncome: parseFloat(corporateIncome) || undefined,
        deductions: selectedDeductions,
        exemptions: selectedExemptions,
        taxYear,
        sectorData,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    income,
    corporateIncome,
    selectedDeductions,
    selectedExemptions,
    taxYear,
    enableLiveCalculation,
    countryId,
  ]);

  const atomicModifiers = useMemo(() => {
    if (enableLiveCalculation && liveCalculationResult?.atomicModifiers) {
      const serverMods = liveCalculationResult.atomicModifiers;
      return {
        taxCollectionEfficiency: serverMods.taxCollectionEfficiency || 1.0,
        economicModifier: serverMods.economicBonus || 0,
        governmentModifier: serverMods.governmentBonus || 0,
        baseRateModifier: serverMods.economicTierMultiplier || 1.0,
        effectiveRateMultiplier: serverMods.taxCollectionEfficiency || 1.0,
        synergies: [],
        conflicts: [],
      };
    }

    if (governmentComponents.length === 0 && economicComponents.length === 0) {
      return {
        taxCollectionEfficiency: 1.0,
        economicModifier: 0,
        governmentModifier: 0,
        baseRateModifier: 1.0,
        effectiveRateMultiplier: 1.0,
        synergies: [],
        conflicts: [],
      };
    }

    const unified = calculateUnifiedAtomicModifiers(governmentComponents, economicComponents, []);

    const economicModifier =
      economicComponents.reduce((sum) => sum + 0.05, 0) / Math.max(economicComponents.length, 1);

    const validGovernmentComponents = governmentComponents.filter((ct): ct is ComponentType =>
      Object.values(ComponentType).includes(ct as ComponentType)
    );

    const taxBoostComponents: ComponentType[] = [
      ComponentType.PROFESSIONAL_BUREAUCRACY,
      ComponentType.RULE_OF_LAW,
      ComponentType.TECHNOCRATIC_AGENCIES,
      ComponentType.DIGITAL_GOVERNMENT,
    ];

    const governmentModifier =
      validGovernmentComponents.reduce((sum, comp) => {
        return taxBoostComponents.includes(comp) ? sum + 0.08 : sum + 0.02;
      }, 0) / Math.max(validGovernmentComponents.length, 1);

    return {
      taxCollectionEfficiency: unified.taxCollectionMultiplier,
      economicModifier,
      governmentModifier,
      baseRateModifier: unified.gdpGrowthModifier,
      effectiveRateMultiplier: 1 + economicModifier + governmentModifier,
      synergies: [],
      conflicts: [],
    };
  }, [governmentComponents, economicComponents, enableLiveCalculation, liveCalculationResult]);

  const calculationResult = useMemo(() => {
    if (enableLiveCalculation && liveCalculationResult) {
      return liveCalculationResult as TaxCalculationResult;
    }

    const incomeValue = parseFloat(income) || 0;
    if (incomeValue <= 0) return null;

    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: incomeValue,
      deductions: selectedDeductions,
      exemptions: selectedExemptions,
    };

    try {
      const baseResult = calculatorEngine.calculate(request);
      if (atomicModifiers.taxCollectionEfficiency !== 1.0) {
        const modifiedTaxOwed = baseResult.taxOwed * atomicModifiers.taxCollectionEfficiency;
        const modifiedEffectiveRate = (modifiedTaxOwed / incomeValue) * 100;
        return {
          ...baseResult,
          taxOwed: modifiedTaxOwed,
          effectiveRate: modifiedEffectiveRate,
          breakdown: baseResult.breakdown.map((category) => ({
            ...category,
            taxOwed: category.taxOwed * atomicModifiers.taxCollectionEfficiency,
          })),
        };
      }
      return baseResult;
    } catch (error) {
      console.error("Tax calculation error:", error);
      return null;
    }
  }, [
    income,
    taxYear,
    selectedDeductions,
    selectedExemptions,
    calculatorEngine,
    taxSystem.id,
    atomicModifiers,
    enableLiveCalculation,
    liveCalculationResult,
  ]);

  const corporateCalculationResult = useMemo(() => {
    const corporateIncomeValue = parseFloat(corporateIncome) || 0;
    if (corporateIncomeValue <= 0) return null;

    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: corporateIncomeValue,
      deductions: selectedCorporateDeductions,
      exemptions: selectedCorporateExemptions,
    };

    try {
      const baseResult = calculatorEngine.calculate(request);
      if (sectorData.length > 0 && economicData?.nominalGDP) {
        const sectorTaxContributions = sectorData.map((sector) => {
          const sectorIncome = (corporateIncomeValue * sector.gdpContribution) / 100;
          const sectorTaxRate = sector.taxRate || baseResult.effectiveRate;
          return {
            sector: sector.name,
            income: sectorIncome,
            taxOwed: (sectorIncome * sectorTaxRate) / 100,
            effectiveRate: sectorTaxRate,
          };
        });

        const totalSectorTax = sectorTaxContributions.reduce((sum, s) => sum + s.taxOwed, 0);
        const modifiedTaxOwed = totalSectorTax * atomicModifiers.taxCollectionEfficiency;
        const modifiedEffectiveRate = (modifiedTaxOwed / corporateIncomeValue) * 100;

        return {
          ...baseResult,
          taxOwed: modifiedTaxOwed,
          effectiveRate: modifiedEffectiveRate,
          breakdown: baseResult.breakdown.map((category) => ({
            ...category,
            taxOwed: category.taxOwed * atomicModifiers.taxCollectionEfficiency,
          })),
          sectorBreakdown: sectorTaxContributions,
        } as TaxCalculationResult & { sectorBreakdown?: typeof sectorTaxContributions };
      }

      if (atomicModifiers.taxCollectionEfficiency !== 1.0) {
        const modifiedTaxOwed = baseResult.taxOwed * atomicModifiers.taxCollectionEfficiency;
        const modifiedEffectiveRate = (modifiedTaxOwed / corporateIncomeValue) * 100;
        return {
          ...baseResult,
          taxOwed: modifiedTaxOwed,
          effectiveRate: modifiedEffectiveRate,
          breakdown: baseResult.breakdown.map((category) => ({
            ...category,
            taxOwed: category.taxOwed * atomicModifiers.taxCollectionEfficiency,
          })),
        };
      }

      return baseResult;
    } catch (error) {
      console.error("Corporate tax calculation error:", error);
      return null;
    }
  }, [
    corporateIncome,
    taxYear,
    selectedCorporateDeductions,
    selectedCorporateExemptions,
    calculatorEngine,
    taxSystem.id,
    sectorData,
    economicData,
    atomicModifiers,
  ]);

  const lastCalculationResultRef = useRef<any>(null);
  useEffect(() => {
    if (onCalculationChange && calculationResult) {
      const simplifiedResult = {
        taxOwed: calculationResult.taxOwed,
        effectiveRate: calculationResult.effectiveRate,
        taxableIncome: calculationResult.taxableIncome,
      };
      if (JSON.stringify(simplifiedResult) !== JSON.stringify(lastCalculationResultRef.current)) {
        lastCalculationResultRef.current = simplifiedResult;
        onCalculationChange(calculationResult);
      }
    } else if (
      onCalculationChange &&
      !calculationResult &&
      lastCalculationResultRef.current !== null
    ) {
      lastCalculationResultRef.current = null;
      onCalculationChange(null);
    }
  }, [calculationResult, onCalculationChange]);

  const suggestions = useMemo(() => {
    if (!calculationResult) return [];
    const incomeValue = parseFloat(income) || 0;
    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: incomeValue,
      deductions: selectedDeductions,
      exemptions: selectedExemptions,
    };
    return calculatorEngine.generateOptimizationSuggestions(request, calculationResult);
  }, [
    calculationResult,
    income,
    taxYear,
    selectedDeductions,
    selectedExemptions,
    calculatorEngine,
    taxSystem.id,
  ]);

  return {
    income,
    setIncome,
    corporateIncome,
    setCorporateIncome,
    taxYear,
    setTaxYear,
    selectedDeductions,
    setSelectedDeductions,
    selectedExemptions,
    setSelectedExemptions,
    activeTab,
    setActiveTab,
    calculatorMode,
    setCalculatorMode,
    calculationTimestamp,
    liveTaxCalculation,
    atomicModifiers,
    calculationResult,
    corporateCalculationResult,
    suggestions,
  };
}
