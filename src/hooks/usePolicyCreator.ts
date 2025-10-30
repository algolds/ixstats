/**
 * usePolicyCreator Hook
 *
 * Custom React hook that encapsulates all state management, validation logic,
 * and business logic for the policy creation wizard.
 *
 * This hook provides:
 * - Form state management for all policy fields
 * - Step navigation with validation
 * - Impact calculations and feasibility assessment
 * - Template application
 * - Policy submission via tRPC
 *
 * @module usePolicyCreator
 */

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '~/trpc/react';
import {
  type PolicyType,
  type PolicyPriority,
  type PolicyTemplate
} from '~/lib/policy-templates';
import {
  validatePolicyStep1,
  validatePolicyStep2,
  validatePolicyStep3,
  validatePolicyStep4,
  validatePolicyStep5,
  calculatePolicyImpact,
  assessPolicyFeasibility,
  type PolicyData,
  type EconomicData,
  type CountryData
} from '~/lib/policy-validation';
import { ATOMIC_COMPONENTS, type ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';

/**
 * Hook configuration interface
 */
interface UsePolicyCreatorConfig {
  /** Country ID for the policy */
  countryId: string;
  /** User ID creating the policy */
  userId: string;
  /** Callback when policy is successfully created */
  onSuccess?: (policyId: string) => void;
  /** Initial draft data (optional) */
  initialDraft?: any;
}

/**
 * Policy form state interface
 */
interface PolicyFormState {
  policyType: PolicyType;
  name: string;
  description: string;
  category: string;
  selectedDepartment: string | null;
  selectedComponents: ComponentType[];
  implementationCost: number;
  maintenanceCost: number;
  priority: PolicyPriority;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  targetMetrics: Record<string, number>;
  autoActivate: boolean;
}

/**
 * Step validation state interface
 */
interface StepValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Calculated impact interface
 */
interface CalculatedImpact {
  gdpImpact: number;
  revenueImpact: number;
  employmentImpact: number;
  budgetBalance: number;
  effectiveness: number;
}

/**
 * Custom hook for policy creator state and logic
 *
 * @param config - Hook configuration
 * @returns Policy creator state and actions
 */
export function usePolicyCreator(config: UsePolicyCreatorConfig) {
  const { countryId, userId, onSuccess, initialDraft } = config;

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Policy form state
  const [formState, setFormState] = useState<PolicyFormState>({
    policyType: 'economic',
    name: '',
    description: '',
    category: '',
    selectedDepartment: null,
    selectedComponents: [],
    implementationCost: 1000000,
    maintenanceCost: 100000,
    priority: 'medium',
    effectiveDate: null,
    expiryDate: null,
    targetMetrics: {},
    autoActivate: false
  });

  // Fetch government builder data
  const { data: governmentData } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch economy data
  const { data: economyData } = api.economics.getEconomyBuilderState.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch tax system data
  const { data: taxData } = api.taxSystem.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Create policy mutation
  const createPolicyMutation = api.policies.createPolicy.useMutation({
    onSuccess: (policy) => {
      toast.success('Policy Created', {
        description: `"${policy.name}" has been successfully created`
      });

      // Auto-activate if requested
      if (formState.autoActivate) {
        activatePolicyMutation.mutate({ id: policy.id });
      }

      onSuccess?.(policy.id);
    },
    onError: (error) => {
      toast.error('Failed to Create Policy', {
        description: error.message
      });
      setIsProcessing(false);
    }
  });

  // Activate policy mutation
  const activatePolicyMutation = api.policies.activatePolicy.useMutation({
    onSuccess: () => {
      toast.success('Policy Activated', {
        description: 'The policy is now in effect'
      });
    }
  });

  /**
   * Calculate policy impact based on builder context
   */
  const calculatedImpact = useMemo((): CalculatedImpact => {
    if (!economyData || !governmentData) {
      return {
        gdpImpact: 0,
        revenueImpact: 0,
        employmentImpact: 0,
        budgetBalance: 0,
        effectiveness: 50
      };
    }

    const gdp = economyData.structure.totalGDP;
    const totalBudget = governmentData?.totalBudget || 0;

    // Base impact calculations
    const baseImpact = calculatePolicyImpact(
      {
        policyType: formState.policyType,
        implementationCost: formState.implementationCost,
        maintenanceCost: formState.maintenanceCost
      },
      { structure: { totalGDP: gdp }, totalBudget }
    );

    let { gdpImpact, employmentImpact, revenueImpact = 0 } = baseImpact;

    // Component synergy bonus
    const synergyBonus = formState.selectedComponents.length > 0
      ? formState.selectedComponents.reduce((acc, comp) => {
          const component = ATOMIC_COMPONENTS[comp];
          return acc + (component?.effectiveness || 0);
        }, 0) / formState.selectedComponents.length / 100
      : 0;

    // Apply synergy multiplier
    gdpImpact *= (1 + synergyBonus);
    revenueImpact *= (1 + synergyBonus);
    employmentImpact *= (1 + synergyBonus);

    const budgetBalance = totalBudget - formState.implementationCost - formState.maintenanceCost;
    const effectiveness = Math.min(
      95,
      50 + synergyBonus * 100 + (
        formState.priority === 'critical' ? 20 :
        formState.priority === 'high' ? 10 : 0
      )
    );

    return {
      gdpImpact: Math.round(gdpImpact * 100) / 100,
      revenueImpact: Math.round(revenueImpact),
      employmentImpact: Math.round(employmentImpact * 100) / 100,
      budgetBalance: Math.round(budgetBalance),
      effectiveness: Math.round(effectiveness)
    };
  }, [
    formState.policyType,
    formState.implementationCost,
    formState.maintenanceCost,
    formState.selectedComponents,
    formState.priority,
    economyData,
    governmentData
  ]);

  /**
   * Calculate feasibility assessment
   */
  const feasibilityAssessment = useMemo(() => {
    if (!economyData || !governmentData) {
      return {
        feasible: true,
        score: 50,
        factors: ['Insufficient data for assessment']
      };
    }

    return assessPolicyFeasibility(
      {
        implementationCost: formState.implementationCost,
        maintenanceCost: formState.maintenanceCost,
        priority: formState.priority
      },
      {
        totalBudget: governmentData.totalBudget,
        gdp: economyData.structure.totalGDP,
        stability: 70 // Default stability
      }
    );
  }, [
    formState.implementationCost,
    formState.maintenanceCost,
    formState.priority,
    economyData,
    governmentData
  ]);

  /**
   * Validate current step
   */
  const stepValidation = useMemo((): StepValidation => {
    switch (currentStep) {
      case 1:
        return validatePolicyStep1(
          formState.policyType,
          formState.name,
          formState.description
        );
      case 2:
        return validatePolicyStep2(formState.selectedDepartment);
      case 3:
        return validatePolicyStep3(
          formState.implementationCost,
          formState.maintenanceCost
        );
      case 4:
        return validatePolicyStep4(
          formState.effectiveDate,
          formState.expiryDate
        );
      case 5:
        return validatePolicyStep5({
          name: formState.name,
          description: formState.description,
          policyType: formState.policyType,
          implementationCost: formState.implementationCost,
          maintenanceCost: formState.maintenanceCost,
          priority: formState.priority,
          effectiveDate: formState.effectiveDate,
          expiryDate: formState.expiryDate
        });
      default:
        return { valid: false, errors: ['Invalid step'] };
    }
  }, [currentStep, formState]);

  /**
   * Check if can proceed to next step
   */
  const canProceed = useMemo(() => {
    return stepValidation.valid;
  }, [stepValidation]);

  /**
   * Update a single form field
   */
  const updateField = useCallback(<K extends keyof PolicyFormState>(
    field: K,
    value: PolicyFormState[K]
  ) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Apply a policy template
   */
  const applyTemplate = useCallback((template: PolicyTemplate) => {
    setFormState(prev => ({
      ...prev,
      policyType: template.policyType,
      name: template.name,
      description: template.description,
      category: template.category,
      implementationCost: template.defaultSettings.implementationCost || 1000000,
      maintenanceCost: template.defaultSettings.maintenanceCost || 100000,
      priority: template.defaultSettings.priority || 'medium',
      targetMetrics: template.defaultSettings.targetMetrics || {}
    }));

    toast.success('Template Applied', {
      description: `Loaded "${template.name}" template`
    });
  }, []);

  /**
   * Navigate to next step
   */
  const nextStep = useCallback(() => {
    if (stepValidation.valid) {
      setCurrentStep(prev => Math.min(5, prev + 1));
    } else {
      toast.error('Please complete all required fields', {
        description: stepValidation.errors[0]
      });
    }
  }, [stepValidation]);

  /**
   * Navigate to previous step
   */
  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  }, []);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormState({
      policyType: 'economic',
      name: '',
      description: '',
      category: '',
      selectedDepartment: null,
      selectedComponents: [],
      implementationCost: 1000000,
      maintenanceCost: 100000,
      priority: 'medium',
      effectiveDate: null,
      expiryDate: null,
      targetMetrics: {},
      autoActivate: false
    });
    setCurrentStep(1);
  }, []);

  /**
   * Submit policy for creation
   */
  const handleSubmit = useCallback(async () => {
    const finalValidation = validatePolicyStep5({
      name: formState.name,
      description: formState.description,
      policyType: formState.policyType,
      implementationCost: formState.implementationCost,
      maintenanceCost: formState.maintenanceCost,
      priority: formState.priority,
      effectiveDate: formState.effectiveDate,
      expiryDate: formState.expiryDate
    });

    if (!finalValidation.valid) {
      toast.error('Please complete all required fields', {
        description: finalValidation.errors[0]
      });
      return;
    }

    setIsProcessing(true);

    try {
      await createPolicyMutation.mutateAsync({
        countryId,
        userId,
        name: formState.name,
        description: formState.description,
        policyType: formState.policyType,
        category: formState.category || formState.policyType,
        effectiveDate: formState.effectiveDate || undefined,
        expiryDate: formState.expiryDate || undefined,
        targetMetrics: JSON.stringify(formState.targetMetrics),
        implementationCost: formState.implementationCost,
        maintenanceCost: formState.maintenanceCost,
        priority: formState.priority
      });
    } catch (error) {
      setIsProcessing(false);
    }
  }, [formState, countryId, userId, createPolicyMutation]);

  return {
    // State
    currentStep,
    isProcessing,
    formData: formState,

    // External data
    governmentData,
    economyData,
    taxData,

    // Computed values
    calculatedImpact,
    feasibilityAssessment,
    stepValidation,
    canProceed,

    // Actions
    updateField,
    applyTemplate,
    nextStep,
    prevStep,
    resetForm,
    handleSubmit
  };
}
