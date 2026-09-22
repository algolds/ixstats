/**
 * Field Importance — configuration and tiers for progressive disclosure.
 *
 * Tiers:
 * - 'primary': Always visible, prominent visual weight, required for completion.
 * - 'secondary': Visible in standard view, moderate weight.
 * - 'advanced': Hidden behind collapsible disclosure in guided mode.
 */

export type FieldImportance = "primary" | "secondary" | "advanced";

export const FIELD_IMPORTANCE: Record<string, Record<string, FieldImportance>> = {
  identity: {
    countryName: "primary",
    flagUrl: "primary",
    capital: "primary",
    region: "primary",
    motto: "secondary",
    anthem: "secondary",
    demonym: "secondary",
    callingCode: "advanced",
    internetTld: "advanced",
    drivingSide: "advanced",
    dateFormat: "advanced",
  },
  government: {
    governmentType: "primary",
    headOfState: "primary",
    headOfGovernment: "primary",
    governmentName: "secondary",
    legislatureName: "advanced",
    executiveName: "advanced",
    judicialName: "advanced",
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
  },
};

/**
 * Returns the importance level of a given field within a section.
 */
export function getFieldImportance(section: string, field: string): FieldImportance {
  return FIELD_IMPORTANCE[section]?.[field] ?? "secondary";
}
