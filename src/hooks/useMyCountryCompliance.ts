import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry";

export interface ComplianceSectionStatus {
  id: "national-identity" | "government" | "economy" | "taxes";
  title: string;
  description: string;
  missing: string[];
  isComplete: boolean;
}

function isValueProvided(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return !Number.isNaN(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

export function useMyCountryCompliance() {
  const { country, userProfile } = useCountryData();
  const countryId = country?.id ?? userProfile?.countryId ?? "";

  const { data: government, isLoading: governmentLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: Boolean(countryId) }
  );

  const { data: taxSystem, isLoading: taxSystemLoading } = api.taxSystem.getByCountryId.useQuery(
    { countryId },
    { enabled: Boolean(countryId) }
  );

  const sections = useMemo<ComplianceSectionStatus[]>(() => {
    if (!countryId || !country) {
      return [];
    }

    const identity = (country as any).nationalIdentity ?? {};

    const nationalIdentityChecks = [
      { label: "Official name", value: identity?.officialName },
      { label: "Capital city", value: identity?.capitalCity },
      { label: "Demonym", value: identity?.demonym },
      { label: "Currency", value: identity?.currency },
      { label: "Currency symbol", value: identity?.currencySymbol },
      { label: "National anthem", value: identity?.nationalAnthem },
      { label: "National day", value: identity?.nationalDay },
      { label: "Primary ISO code", value: identity?.isoCode },
      { label: "Flag image", value: identity?.flagUrl },
      { label: "Coat of arms image", value: identity?.coatOfArmsUrl },
    ];

    const missingIdentity = nationalIdentityChecks
      .filter((field) => !isValueProvided(field.value))
      .map((field) => field.label);

    const missingGovernment: string[] = [];
    if (!government) {
      missingGovernment.push(
        "Create a government structure with departments and budget allocations"
      );
    } else {
      if (!isValueProvided((government as any).governmentName)) {
        missingGovernment.push("Government name");
      }
      if (!isValueProvided((government as any).governmentType)) {
        missingGovernment.push("Government type");
      }
      if (!isValueProvided((government as any).totalBudget)) {
        missingGovernment.push("Total government budget");
      }
      if (!isValueProvided(government.departments)) {
        missingGovernment.push("Departments and agencies");
      }
      if (!isValueProvided(government.budgetAllocations)) {
        missingGovernment.push("Budget allocations");
      }
      if (!isValueProvided(government.revenueSources)) {
        missingGovernment.push("Revenue sources");
      }
    }

    const economyChecks = [
      { label: "Nominal GDP", value: (country as any).nominalGDP },
      {
        label: "Real GDP growth rate",
        value: (country as any).realGDPGrowthRate,
      },
      { label: "Inflation rate", value: (country as any).inflationRate },
      { label: "Unemployment rate", value: (country as any).unemploymentRate },
      {
        label: "Tax revenue (% of GDP)",
        value: (country as any).taxRevenueGDPPercent,
      },
    ];

    const missingEconomy = economyChecks
      .filter((field) => !isValueProvided(field.value))
      .map((field) => field.label);

    const missingTaxes: string[] = [];
    if (!taxSystem) {
      missingTaxes.push("Set up the national tax system");
    } else {
      if (!isValueProvided(taxSystem.taxSystem.taxSystemName)) {
        missingTaxes.push("Tax system name");
      }
      if (!isValueProvided(taxSystem.taxSystem.taxAuthority)) {
        missingTaxes.push("Tax authority details");
      }
      if (!isValueProvided(taxSystem.categories)) {
        missingTaxes.push("Tax categories");
      } else if (
        Array.isArray(taxSystem.categories) &&
        !taxSystem.categories.some(
          (category: any) => Array.isArray(category.taxBrackets) && category.taxBrackets.length > 0
        )
      ) {
        missingTaxes.push("Tax brackets or rate structure");
      }
      if (!isValueProvided(taxSystem.taxSystem.complianceRate)) {
        missingTaxes.push("Compliance rate target");
      }
      if (!isValueProvided(taxSystem.taxSystem.collectionEfficiency)) {
        missingTaxes.push("Collection efficiency target");
      }
    }

    const sectionList: ComplianceSectionStatus[] = [
      {
        id: "national-identity",
        title: "National Identity",
        description:
          "Official identity details shown across the MyCountry and public diplomacy surfaces.",
        missing: missingIdentity,
        isComplete: missingIdentity.length === 0,
      },
      {
        id: "government",
        title: "MyGovernment",
        description:
          "Government structure, departments, and fiscal allocations used by executive dashboards.",
        missing: missingGovernment,
        isComplete: missingGovernment.length === 0,
      },
      {
        id: "economy",
        title: "Economy",
        description:
          "Core economic indicators powering analytics, projections, and tax recommendations.",
        missing: missingEconomy,
        isComplete: missingEconomy.length === 0,
      },
      {
        id: "taxes",
        title: "Taxes",
        description:
          "Tax builder configuration and compliance targets required for revenue modeling.",
        missing: missingTaxes,
        isComplete: missingTaxes.length === 0,
      },
    ];

    return sectionList;
  }, [countryId, country, government, taxSystem]);

  const isCompliant = sections.length > 0 && sections.every((s) => s.isComplete);

  return {
    sections,
    isCompliant,
    loading: governmentLoading || taxSystemLoading,
    countryId,
  };
}
