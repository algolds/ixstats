import { useMemo } from 'react';
import type { BuilderState } from './useBuilderState';
import type { BuilderStep } from '../components/enhanced/builderConfig';

/**
 * Validation result structure containing validation status and messages.
 */
export interface ValidationResult {
  /** Whether the validation passed (no errors) */
  isValid: boolean;
  /** Critical errors that block progression */
  errors: string[];
  /** Non-blocking warnings for user attention */
  warnings: string[];
}

/**
 * Return value interface for useBuilderValidation hook.
 * Provides validation methods for builder state.
 */
export interface UseBuilderValidationReturn {
  /** Validate a specific builder step */
  validateStep: (step: BuilderStep) => ValidationResult;
  /** Validate all steps at once */
  validateAll: () => ValidationResult;
  /** Whether the country is ready to be created */
  canCreateCountry: boolean;
}

/**
 * Props interface for useBuilderValidation hook.
 */
interface UseBuilderValidationProps {
  /** Current builder state from useBuilderState */
  builderState: BuilderState;
}

/**
 * Builder validation hook for ensuring data integrity and completeness.
 *
 * Provides comprehensive validation for each step of the builder workflow:
 * - Foundation: Country selection validation
 * - Core: National identity and indicators validation
 * - Government: Component and structure validation
 * - Economics: Fiscal, spending, and employment validation
 * - Preview: Complete state validation
 *
 * Returns both blocking errors and non-blocking warnings for user feedback.
 * Validation results are memoized for performance.
 *
 * @hook
 * @param {UseBuilderValidationProps} props - Builder state to validate
 * @param {BuilderState} props.builderState - Current builder state
 * @returns {UseBuilderValidationReturn} Validation methods and status
 * @returns {Function} returns.validateStep - Validate specific step
 * @returns {Function} returns.validateAll - Validate all steps
 * @returns {boolean} returns.canCreateCountry - Whether country can be created
 *
 * @example
 * ```tsx
 * function ValidationFeedback() {
 *   const { builderState } = useBuilderState();
 *   const { validateStep, canCreateCountry } = useBuilderValidation({ builderState });
 *
 *   const currentValidation = validateStep(builderState.step);
 *
 *   return (
 *     <div>
 *       {currentValidation.errors.map(error => (
 *         <div key={error} className="text-red-500">{error}</div>
 *       ))}
 *       {currentValidation.warnings.map(warning => (
 *         <div key={warning} className="text-yellow-500">{warning}</div>
 *       ))}
 *       <button disabled={!canCreateCountry}>Create Country</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Validate before allowing step progression
 * function ContinueButton() {
 *   const { builderState } = useBuilderState();
 *   const { validateStep } = useBuilderValidation({ builderState });
 *   const { handleContinue } = useBuilderActions({ builderState, setBuilderState });
 *
 *   const handleClick = () => {
 *     const validation = validateStep(builderState.step);
 *     if (!validation.isValid) {
 *       alert(`Cannot continue: ${validation.errors.join(', ')}`);
 *       return;
 *     }
 *     handleContinue();
 *   };
 *
 *   return <button onClick={handleClick}>Continue</button>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Display all validation issues
 * function ValidationSummary() {
 *   const { builderState } = useBuilderState();
 *   const { validateAll } = useBuilderValidation({ builderState });
 *
 *   const allValidation = validateAll();
 *
 *   return (
 *     <div>
 *       <h3>Validation Summary</h3>
 *       <p>Status: {allValidation.isValid ? 'Valid' : 'Invalid'}</p>
 *       <p>Errors: {allValidation.errors.length}</p>
 *       <p>Warnings: {allValidation.warnings.length}</p>
 *       <ul>
 *         {allValidation.errors.map(error => (
 *           <li key={error} className="text-red-500">{error}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBuilderValidation({
  builderState,
}: UseBuilderValidationProps): UseBuilderValidationReturn {
  // Validate foundation step
  const validateFoundation = useMemo((): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!builderState.selectedCountry) {
      errors.push('No foundation country selected');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }, [builderState.selectedCountry]);

  // Validate core step
  const validateCore = useMemo((): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!builderState.economicInputs) {
      errors.push('Economic inputs not configured');
      return { isValid: false, errors, warnings };
    }

    const { nationalIdentity, coreIndicators } = builderState.economicInputs;

    if (!nationalIdentity?.countryName || nationalIdentity.countryName.trim() === '') {
      errors.push('Country name is required');
    }

    if (!nationalIdentity?.capitalCity || nationalIdentity.capitalCity.trim() === '') {
      warnings.push('Capital city not specified');
    }

    if (coreIndicators?.nominalGDP <= 0) {
      errors.push('Nominal GDP must be greater than 0');
    }

    if (coreIndicators?.totalPopulation <= 0) {
      errors.push('Population must be greater than 0');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }, [builderState.economicInputs]);

  // Validate government step
  const validateGovernment = useMemo((): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (builderState.governmentComponents.length === 0) {
      warnings.push('No government components selected');
    }

    if (builderState.governmentComponents.length < 3) {
      warnings.push('At least 3 components recommended for a functional government');
    }

    if (builderState.governmentComponents.length > 15) {
      warnings.push('More than 15 components may increase complexity significantly');
    }

    if (!builderState.governmentStructure) {
      warnings.push('Government structure not configured');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }, [builderState.governmentComponents, builderState.governmentStructure]);

  // Validate economics step
  const validateEconomics = useMemo((): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!builderState.economicInputs) {
      errors.push('Economic inputs not configured');
      return { isValid: false, errors, warnings };
    }

    const { fiscalSystem, governmentSpending, laborEmployment } = builderState.economicInputs;

    if (fiscalSystem.taxRevenueGDPPercent < 0 || fiscalSystem.taxRevenueGDPPercent > 100) {
      errors.push('Tax revenue percentage must be between 0 and 100');
    }

    if (governmentSpending.totalSpending < 0 || governmentSpending.totalSpending > 100) {
      errors.push('Government spending percentage must be between 0 and 100');
    }

    if (laborEmployment.unemploymentRate < 0 || laborEmployment.unemploymentRate > 100) {
      errors.push('Unemployment rate must be between 0 and 100');
    }

    if (governmentSpending.totalSpending > fiscalSystem.taxRevenueGDPPercent * 1.5) {
      warnings.push('Government spending significantly exceeds tax revenue (potential deficit)');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }, [builderState.economicInputs]);

  // Validate specific step
  const validateStep = useMemo(
    () =>
      (step: BuilderStep): ValidationResult => {
        switch (step) {
          case 'foundation':
            return validateFoundation;
          case 'core':
            return validateCore;
          case 'government':
            return validateGovernment;
          case 'economics':
            return validateEconomics;
          case 'preview':
            return validateAll();
          default:
            return { isValid: true, errors: [], warnings: [] };
        }
      },
    [validateFoundation, validateCore, validateGovernment, validateEconomics]
  );

  // Validate all steps
  const validateAll = useMemo(
    () =>
      (): ValidationResult => {
        const allErrors: string[] = [];
        const allWarnings: string[] = [];

        const steps: BuilderStep[] = ['foundation', 'core', 'government', 'economics'];
        steps.forEach((step) => {
          const result = validateStep(step);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
        });

        return {
          isValid: allErrors.length === 0,
          errors: allErrors,
          warnings: allWarnings,
        };
      },
    [validateStep]
  );

  // Check if country creation is allowed
  const canCreateCountry = useMemo(() => {
    const validation = validateAll();
    return (
      validation.isValid &&
      builderState.economicInputs !== null &&
      builderState.completedSteps.length >= 4
    );
  }, [validateAll, builderState.economicInputs, builderState.completedSteps]);

  return {
    validateStep,
    validateAll,
    canCreateCountry,
  };
}
