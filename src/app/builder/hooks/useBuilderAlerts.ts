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

"use client";

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
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
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
    const alerts: BuilderAlert[] = [];

    // ── Identity alerts ──
    if (nationalIdentity) {
      if (!nationalIdentity.countryName?.trim()) {
        alerts.push({
          severity: "error",
          message: "Country name is required",
          section: "identity",
          field: "countryName",
        });
      }
      if (!nationalIdentity.capitalCity?.trim()) {
        alerts.push({
          severity: "warning",
          message: "Capital city is not set",
          section: "identity",
          field: "capitalCity",
        });
      }
    }

    // ── Government alerts ──
    if (governmentStructure) {
      // Use the pure helper for GDP cap warning (delta/currency baseline
      // not available in global context — those stay inline-only in GovernmentStep)
      const govWarnings = computeGovernmentWarnings(
        governmentStructure,
        nominalGDP,
        null, // baseline budget not persisted to global state
        null // baseline currency not persisted to global state
      );

      if (govWarnings.gdpCapWarning) {
        alerts.push({
          severity: "error",
          message: govWarnings.gdpCapWarning,
          section: "government",
          tab: "spending",
          field: "totalBudget",
        });
      }
    }

    // ── Economy alerts ──
    if (economyBuilderState) {
      const econValidation = validateEconomy(economyBuilderState, selectedEconomicComponents);

      for (const msg of econValidation.messages) {
        // Skip success messages — they're not alerts
        if (msg.severity === "success") continue;

        // Map byTab keys to economy sub-tabs
        let tab: string | undefined;
        if (econValidation.byTab.sectors.includes(msg)) tab = "sectors";
        else if (econValidation.byTab.labor.includes(msg)) tab = "labor";
        else if (econValidation.byTab.demographics.includes(msg)) tab = "labor"; // merged tab

        alerts.push({
          severity: msg.severity as "error" | "warning" | "info",
          message: msg.message,
          section: "economics",
          tab,
          field: msg.field,
        });
      }
    }

    // ── Tax alerts ──
    if (taxSystemData) {
      const taxValidation = validateTaxBuilderState(taxSystemData);
      if (!taxValidation.isValid) {
        // Flatten all tax errors into alerts
        for (const [_key, value] of Object.entries(taxValidation.errors)) {
          if (Array.isArray(value)) {
            for (const err of value) {
              alerts.push({
                severity: "error",
                message: String(err),
                section: "economics",
                tab: "tax",
              });
            }
          } else if (typeof value === "object" && value !== null) {
            for (const [_subKey, subErrors] of Object.entries(value as Record<string, unknown>)) {
              const errList = Array.isArray(subErrors) ? subErrors : [subErrors];
              for (const err of errList) {
                alerts.push({
                  severity: "error",
                  message: String(err),
                  section: "economics",
                  tab: "tax",
                });
              }
            }
          }
        }
      }
    }

    // ── Compute counts ──
    const counts = countAlerts(alerts);

    // ── Per-section counts ──
    const sectionCounts = {} as Record<BuilderSection, BuilderAlertCounts>;
    for (const s of ALL_SECTIONS) {
      const sectionAlerts = alerts.filter((a) => a.section === s);
      sectionCounts[s] =
        sectionAlerts.length > 0 ? countAlerts(sectionAlerts) : { ...EMPTY_COUNTS };
    }

    // ── forSection helper ──
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
