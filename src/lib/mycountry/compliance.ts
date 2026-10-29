/**
 * The profile checklist behind the MyCountry compliance prompt. Every check is something the owner
 * can fill: identity in the editor, the form of government in the editor, departments and
 * allocations in the National budget tab, tax rates in the Fiscal policy tab. Computed values
 * (GDP, growth, inflation) are never checked: they are always present.
 */

export interface ComplianceSectionStatus {
  id: "national-identity" | "government" | "taxes";
  title: string;
  description: string;
  missing: string[];
  isComplete: boolean;
}

/** The identity fields the editor's Identity group edits, with the editor's own labels. */
const IDENTITY_CHECKS = [
  { key: "officialName", label: "Official name" },
  { key: "capitalCity", label: "Capital city" },
  { key: "demonym", label: "Demonym" },
  { key: "currency", label: "Currency" },
  { key: "currencySymbol", label: "Currency symbol" },
  { key: "nationalAnthem", label: "National anthem" },
  { key: "nationalDay", label: "National day" },
  { key: "isoCode", label: "Country code" },
] as const;

type IdentityCheckKey = (typeof IDENTITY_CHECKS)[number]["key"];

/** The "no structure yet" item; Review sends it to the editor's government form. */
export const COMPLIANCE_NO_GOVERNMENT = "Pick a form of government";
export const COMPLIANCE_GOVERNMENT_TYPE = "Government type";

export interface ComplianceInput {
  flag: string | null | undefined;
  coatOfArms: string | null | undefined;
  identity: Partial<Record<IdentityCheckKey, string | null>> | null | undefined;
  government:
    | {
        governmentType?: string | null;
        departments?: readonly object[] | null;
        budgetAllocations?: readonly object[] | null;
      }
    | null
    | undefined;
  /** True when at least one national tax rate is saved. */
  hasTaxRates: boolean;
}

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function missingIdentity(input: ComplianceInput): string[] {
  const missing: string[] = IDENTITY_CHECKS.filter(({ key }) => !filled(input.identity?.[key])).map(
    ({ label }) => label
  );
  if (!filled(input.flag)) missing.push("Flag");
  if (!filled(input.coatOfArms)) missing.push("Coat of arms");
  return missing;
}

function missingGovernment(government: ComplianceInput["government"]): string[] {
  // A bare structure (no departments, no type: an issue's consequence created it) is no government yet.
  if (!government || (!government.departments?.length && !filled(government.governmentType))) {
    return [COMPLIANCE_NO_GOVERNMENT];
  }
  const missing: string[] = [];
  if (!filled(government.governmentType)) missing.push(COMPLIANCE_GOVERNMENT_TYPE);
  if (!government.departments?.length) missing.push("Departments");
  if (!government.budgetAllocations?.length) missing.push("Budget allocations");
  return missing;
}

function section(
  id: ComplianceSectionStatus["id"],
  title: string,
  description: string,
  missing: string[]
): ComplianceSectionStatus {
  return { id, title, description, missing, isComplete: missing.length === 0 };
}

export function complianceSections(input: ComplianceInput): ComplianceSectionStatus[] {
  return [
    section(
      "national-identity",
      "National identity",
      "Official identity details shown across MyCountry and diplomacy.",
      missingIdentity(input)
    ),
    section(
      "government",
      "Government",
      "The form of government, its departments and the budget allocations.",
      missingGovernment(input.government)
    ),
    section(
      "taxes",
      "Taxes",
      "National tax rates, which set the revenue every tab shows.",
      input.hasTaxRates ? [] : ["Tax rates"]
    ),
  ];
}
