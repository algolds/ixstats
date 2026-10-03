"use client";

/**
 * useBuilderAlerts — unified alert derivation hook.
 *
 * IMPORTANT: This is a PURE DERIVATION hook. It reads builder state and
 * produces alerts. It MUST NOT write back into builder context (loop risk
 * with existing sync effects in EconomyBuilderPage).
 *
 * Composes alerts from:
 *   - Economy: `validateEconomy()` → structured messages with field/tab info
 *   - Government: `computeGovernmentWarnings()` → GDP cap, delta, currency
 *   - Tax: `validateTaxBuilderState()` → tax-specific validation
 *   - Foundation/Identity: coarse step validation via builder state checks
 */

import { useMemo } from "react";
import type { BuilderSection } from "~/app/builder/lib/builder-theme";
import type {
  BuilderAlert,
  BuilderAlertCounts,
  BuilderAlertResult,
} from "~/app/builder/lib/builder-alerts";
import { validateEconomy } from "~/app/builder/components/enhanced/tabs/utils/validation";
import { computeGovernmentWarnings } from "~/app/builder/components/enhanced/government-preview/governmentWarnings";
import { validateTaxBuilderState } from "~/lib/economy/tax-builder-validation";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

interface UseBuilderAlertsInput {
  /** Economy builder state (null if not yet initialized) */
  economyBuilderState: EconomyBuilderState | null;
  /** Selected atomic economic components */
  selectedEconomicComponents: EconomicComponentType[];
  /** Government structure from builder context */
  governmentStructure: {
    structure?: { totalBudget?: number; budgetCurrency?: string };
  } | null;
  /** Nominal GDP for government budget checks */
  nominalGDP: number;
  /** Tax builder state (null if not configured) */
  taxSystemData: TaxBuilderState | null;
  /** National identity fields (for foundation/identity validation) */
  nationalIdentity: {
    countryName?: string;
    capitalCity?: string;
  } | null;
}

const EMPTY_COUNTS: BuilderAlertCounts = { error: 0, warning: 0, info: 0, total: 0 };
const ALL_SECTIONS: BuilderSection[] = [
  "foundation",
  "identity",
  "government",
  "economics",
  "preview",
  "import",
];

function countAlerts(alerts: BuilderAlert[]): BuilderAlertCounts {
  let error = 0;
  let warning = 0;
  let info = 0;
  for (const a of alerts) {
    if (a.severity === "error") error++;
    else if (a.severity === "warning") warning++;
    else info++;
  }
  return { error, warning, info, total: error + warning + info };
}

function identityAlerts(identity: NonNullable<UseBuilderAlertsInput["nationalIdentity"]>) {
  const alerts: BuilderAlert[] = [];
  if (!identity.countryName?.trim()) {
    alerts.push({
      severity: "error",
      message: "Country name is required",
      section: "identity",
      field: "countryName",
    });
  }
  if (!identity.capitalCity?.trim()) {
    alerts.push({
      severity: "warning",
      message: "Capital city is not set",
      section: "identity",
      field: "capitalCity",
    });
  }
  return alerts;
}

function governmentAlerts(
  governmentStructure: NonNullable<UseBuilderAlertsInput["governmentStructure"]>,
  nominalGDP: number
): BuilderAlert[] {
  // The pure helper for the GDP cap warning (the delta/currency baseline is not in the global
  // context, so those stay inline-only in GovernmentStep).
  const { gdpCapWarning } = computeGovernmentWarnings(governmentStructure, nominalGDP, null, null);
  return gdpCapWarning
    ? [
        {
          severity: "error",
          message: gdpCapWarning,
          section: "government",
          tab: "spending",
          field: "totalBudget",
        },
      ]
    : [];
}

function economyAlerts(
  economyBuilderState: EconomyBuilderState,
  selectedEconomicComponents: EconomicComponentType[]
): BuilderAlert[] {
  const { messages, byTab } = validateEconomy(economyBuilderState, selectedEconomicComponents);
  // Demographics share the labor tab in the economy UI.
  const tabOf = (msg: (typeof messages)[number]) =>
    byTab.sectors.includes(msg)
      ? "sectors"
      : byTab.labor.includes(msg) || byTab.demographics.includes(msg)
        ? "labor"
        : undefined;

  return messages
    .filter((msg) => msg.severity !== "success")
    .map((msg) => ({
      severity: msg.severity as "error" | "warning" | "info",
      message: msg.message,
      section: "economics",
      tab: tabOf(msg),
      field: msg.field,
    }));
}

/** Tax validation errors, flattened from either a list or a keyed group of lists. */
function taxAlerts(taxSystemData: TaxBuilderState): BuilderAlert[] {
  const { isValid, errors } = validateTaxBuilderState(taxSystemData);
  if (isValid) return [];

  const messages = Object.values(errors).flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "object" || value === null) return [];
    return Object.values(value as Record<string, unknown>).flatMap((group) =>
      Array.isArray(group) ? group : [group]
    );
  });
  return messages.map((err) => ({
    severity: "error",
    message: String(err),
    section: "economics",
    tab: "tax",
  }));
}

export function useBuilderAlerts(input: UseBuilderAlertsInput): BuilderAlertResult {
  const {
    economyBuilderState,
    selectedEconomicComponents,
    governmentStructure,
    nominalGDP,
    taxSystemData,
    nationalIdentity,
  } = input;

  return useMemo(() => {
    const alerts: BuilderAlert[] = [
      ...(nationalIdentity ? identityAlerts(nationalIdentity) : []),
      ...(governmentStructure ? governmentAlerts(governmentStructure, nominalGDP) : []),
      ...(economyBuilderState
        ? economyAlerts(economyBuilderState, selectedEconomicComponents)
        : []),
      ...(taxSystemData ? taxAlerts(taxSystemData) : []),
    ];

    const counts = countAlerts(alerts);
    const sectionCounts = {} as Record<BuilderSection, BuilderAlertCounts>;
    for (const s of ALL_SECTIONS) {
      const sectionAlerts = alerts.filter((a) => a.section === s);
      sectionCounts[s] =
        sectionAlerts.length > 0 ? countAlerts(sectionAlerts) : { ...EMPTY_COUNTS };
    }

    const forSection = (section: BuilderSection) => alerts.filter((a) => a.section === section);

    return { alerts, counts, forSection, sectionCounts };
  }, [
    economyBuilderState,
    selectedEconomicComponents,
    governmentStructure,
    nominalGDP,
    taxSystemData,
    nationalIdentity,
  ]);
}
