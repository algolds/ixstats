/**
 * Field Importance — configuration and tiers for progressive disclosure.
 *
 * Tiers:
 * - 'primary': Always visible, prominent visual weight, required for completion.
 * - 'secondary': Visible in standard view, moderate weight.
 * - 'advanced': Hidden behind collapsible disclosure in guided mode.
 *
 * Keys are the real field names the builder forms read and write.
 */

type FieldImportance = "primary" | "secondary" | "advanced";

export const FIELD_IMPORTANCE: Record<string, Record<string, FieldImportance>> = {
  identity: {
    countryName: "primary",
    flagUrl: "primary",
    governmentType: "primary",
    capitalCity: "primary",
    officialName: "secondary",
    demonym: "secondary",
    motto: "secondary",
    nationalAnthem: "secondary",
    largestCity: "advanced",
    callingCode: "advanced",
    internetTLD: "advanced",
    drivingSide: "advanced",
    weekStartDay: "advanced",
  },
  government: {
    governmentType: "primary",
    headOfState: "primary",
    headOfGovernment: "primary",
    totalBudget: "primary",
    governmentName: "secondary",
    fiscalStance: "secondary",
    legislatureName: "advanced",
    executiveName: "advanced",
    judicialName: "advanced",
    auditLevel: "advanced",
    reserveTarget: "advanced",
    debtLimit: "advanced",
    fiscalYear: "advanced",
    budgetCurrency: "advanced",
  },
  economics: {
    gdpNominal: "primary",
    population: "primary",
    currency: "primary",
    gdpPerCapita: "secondary",
    giniCoefficient: "secondary",
    hdiScore: "secondary",
    inflationRate: "advanced",
    unemploymentRate: "advanced",
    publicDebt: "advanced",
    youthUnemploymentRate: "advanced",
    seniorEmploymentRate: "advanced",
    unionizationRate: "advanced",
    collectiveBargainingCoverage: "advanced",
    paidVacationDays: "advanced",
    paidSickLeaveDays: "advanced",
    parentalLeaveWeeks: "advanced",
    netMigrationRate: "advanced",
    immigrationRate: "advanced",
    emigrationRate: "advanced",
    infantMortalityRate: "advanced",
    maternalMortalityRate: "advanced",
    healthExpenditureGDP: "advanced",
  },
};

/**
 * Returns the importance level of a given field within a section.
 */
export function getFieldImportance(section: string, field: string): FieldImportance {
  return FIELD_IMPORTANCE[section]?.[field] ?? "secondary";
}

export type FieldValue = string | number | boolean | null | undefined;

interface AutoOpenOptions<K extends string> {
  /** Baseline values; an advanced field only counts as filled when it differs from its default. */
  defaults?: Readonly<Partial<Record<K, FieldValue>>>;
  /** Fields that currently have a validation error. */
  errorFields?: readonly string[];
}

function isFilled(value: FieldValue, defaultValue: FieldValue): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return value !== defaultValue;
}

/**
 * Whether an "advanced options" disclosure must open by itself: true when any
 * advanced field among `values` has a validation error or a non-default value,
 * so collapsing never hides something required or already filled in.
 */
export function shouldAutoOpenAdvanced<K extends string>(
  section: string,
  values: Readonly<Record<K, FieldValue>>,
  { defaults, errorFields = [] }: AutoOpenOptions<K> = {}
): boolean {
  const fields = Object.keys(values) as K[];
  return fields.some(
    (field) =>
      getFieldImportance(section, field) === "advanced" &&
      (errorFields.includes(field) || isFilled(values[field], defaults?.[field]))
  );
}
