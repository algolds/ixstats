import type { PrismaClient } from "@prisma/client";

export interface DecretalSliderOption {
  label: string;
  value: number; // multiplier or baseline factor
}

export interface DecretalSlider {
  key: string;
  label: string;
  options: DecretalSliderOption[];
}

export interface PolicyDecretal {
  key: string;
  name: string;
  description: string;
  category: string;     // e.g. "fiscal", "trade", "labor", "healthcare", "defense", "infrastructure"
  policyType: string;   // e.g. "economic", "social", "diplomatic", "governance"
  sliders: DecretalSlider[];
  calculate: (settings: Record<string, number>, countryMetrics: any) => {
    implementationCost: number;
    maintenanceCost: number;
    gdpEffect: number;
    employmentEffect: number;
    inflationEffect: number;
    taxRevenueEffect: number;
    stabilityEffect: number;
  };
}

export const PREDEFINED_DECRETALS: Record<string, PolicyDecretal> = {
  "universal-basic-income": {
    key: "universal-basic-income",
    name: "Universal Basic Income Act",
    description: "Provide a regular, unconditional cash transfer to all citizens to eradicate poverty and support consumer demand.",
    category: "fiscal",
    policyType: "economic",
    sliders: [
      {
        key: "stipend",
        label: "Stipend Level",
        options: [
          { label: "None", value: 0 },
          { label: "Low ($200/yr)", value: 1 },
          { label: "Moderate ($800/yr)", value: 2 },
          { label: "Generous ($2500/yr)", value: 3 },
        ]
      },
      {
        key: "funding",
        label: "Funding Model",
        options: [
          { label: "Income Tax Surpass", value: 0 },
          { label: "Value-Added Tax (VAT)", value: 1 },
          { label: "Deficit Spending (Debt)", value: 2 },
        ]
      }
    ],
    calculate: (settings, countryMetrics) => {
      const stipendVal = settings.stipend ?? 0;
      const fundingVal = settings.funding ?? 0;
      const pop = countryMetrics?.currentPopulation ?? 1000000;

      const stipendRates = [0, 200, 800, 2500];
      const stipendRate = stipendRates[stipendVal] ?? 0;

      const maintenanceCost = stipendRate * pop;
      const implementationCost = maintenanceCost * 0.05; // 5% setup

      if (stipendVal === 0) {
        return {
          implementationCost: 0,
          maintenanceCost: 0,
          gdpEffect: 0,
          employmentEffect: 0,
          inflationEffect: 0,
          taxRevenueEffect: 0,
          stabilityEffect: 0
        };
      }

      let gdpEffect = stipendVal * 0.8;
      let employmentEffect = stipendVal * -0.6;
      let inflationEffect = stipendVal * 1.2;
      let stabilityEffect = stipendVal * 2.5;
      let taxRevenueEffect = 0;

      if (fundingVal === 0) { // Income Tax
        gdpEffect -= stipendVal * 0.3;
        taxRevenueEffect += stipendVal * 3;
        employmentEffect -= 0.2;
      } else if (fundingVal === 1) { // VAT
        gdpEffect -= stipendVal * 0.2;
        taxRevenueEffect += stipendVal * 2.5;
        inflationEffect += stipendVal * 0.5;
      } else { // Debt
        gdpEffect += stipendVal * 0.2;
        taxRevenueEffect -= stipendVal * 1.5;
        stabilityEffect -= stipendVal * 0.5;
      }

      return {
        implementationCost,
        maintenanceCost,
        gdpEffect,
        employmentEffect,
        inflationEffect,
        taxRevenueEffect,
        stabilityEffect
      };
    }
  },
  "border-tariffs": {
    key: "border-tariffs",
    name: "Border Tariffs Act",
    description: "Levy import duties on foreign products to protect domestic manufacturing and raise customs revenue.",
    category: "trade",
    policyType: "economic",
    sliders: [
      {
        key: "tariffRate",
        label: "Tariff Rate",
        options: [
          { label: "Free Trade (0%)", value: 0 },
          { label: "Low (5%)", value: 1 },
          { label: "Moderate (15%)", value: 2 },
          { label: "High (30%)", value: 3 },
          { label: "Maximum (50%)", value: 4 },
        ]
      },
      {
        key: "exceptions",
        label: "Regional Exemptions",
        options: [
          { label: "None", value: 0 },
          { label: "Allied Nations Only", value: 1 },
          { label: "Developing Nations Only", value: 2 },
        ]
      }
    ],
    calculate: (settings, countryMetrics) => {
      const rate = settings.tariffRate ?? 0;
      const exceptions = settings.exceptions ?? 0;

      const implementationCost = 5000000;
      const maintenanceCost = 0;

      let gdpEffect = 0;
      let employmentEffect = 0;
      let inflationEffect = 0;
      let taxRevenueEffect = 0;
      let stabilityEffect = 0;

      if (rate === 0) { // Free Trade
        gdpEffect = 1.5;
        employmentEffect = 0.5;
        inflationEffect = -0.5;
        taxRevenueEffect = -1.0;
        stabilityEffect = 1.0;
      } else {
        gdpEffect = -rate * 0.8;
        employmentEffect = rate * 0.4;
        inflationEffect = rate * 1.0;
        taxRevenueEffect = rate * 2.0;
        stabilityEffect = -rate * 0.5;

        if (exceptions === 1) { // Allied Exceptions
          gdpEffect += rate * 0.2;
          taxRevenueEffect -= rate * 0.3;
        } else if (exceptions === 2) { // Developing Exceptions
          gdpEffect += rate * 0.1;
          taxRevenueEffect -= rate * 0.2;
        }
      }

      return {
        implementationCost,
        maintenanceCost,
        gdpEffect,
        employmentEffect,
        inflationEffect,
        taxRevenueEffect,
        stabilityEffect
      };
    }
  },
  "surveillance-oversight": {
    key: "surveillance-oversight",
    name: "Surveillance Oversight Act",
    description: "Authorize broad telecommunication monitoring to counter internal security threats and espionage.",
    category: "defense",
    policyType: "social",
    sliders: [
      {
        key: "surveillance",
        label: "Surveillance Level",
        options: [
          { label: "None (Warrant-Only)", value: 0 },
          { label: "Targeted monitoring", value: 1 },
          { label: "Broad metadata tracking", value: 2 },
          { label: "Maximum deep-packet inspection", value: 3 },
        ]
      }
    ],
    calculate: (settings, countryMetrics) => {
      const level = settings.surveillance ?? 0;

      const implementationCost = level * 10000000;
      const maintenanceCost = level * 2000000;

      let gdpEffect = 0;
      let employmentEffect = 0;
      let inflationEffect = 0;
      let taxRevenueEffect = 0;
      let stabilityEffect = 0;

      if (level === 0) {
        stabilityEffect = 1.0;
      } else {
        gdpEffect = -level * 0.2;
        stabilityEffect = -level * 0.8 + (level === 1 ? 1.0 : 0);
        taxRevenueEffect = -level * 0.1;
      }

      return {
        implementationCost,
        maintenanceCost,
        gdpEffect,
        employmentEffect,
        inflationEffect,
        taxRevenueEffect,
        stabilityEffect
      };
    }
  }
};

export async function getPolicyDecretals(db: any): Promise<Record<string, PolicyDecretal>> {
  const decretals: Record<string, PolicyDecretal> = { ...PREDEFINED_DECRETALS };

  try {
    const dbTemplates = await db.quickActionTemplate.findMany({
      where: { actionType: "policy", isActive: true }
    });

    for (const template of dbTemplates) {
      if (decretals[template.id]) continue;

      let parsedSettings: any = {};
      if (template.defaultSettings) {
        try {
          parsedSettings = JSON.parse(template.defaultSettings);
        } catch {}
      }

      const costMult = parsedSettings.costMultiplier ?? 1.0;
      const effectMult = parsedSettings.effectMultiplier ?? 1.0;

      decretals[template.id] = {
        key: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        policyType: "economic",
        sliders: [
          {
            key: "funding",
            label: "Funding Level",
            options: [
              { label: "Minimal", value: 1 },
              { label: "Standard", value: 2 },
              { label: "High", value: 3 },
              { label: "Extreme", value: 4 },
            ]
          }
        ],
        calculate: (settings) => {
          const val = settings.funding ?? 2;
          return {
            implementationCost: val * 2500000 * costMult,
            maintenanceCost: val * 500000 * costMult,
            gdpEffect: val * 0.2 * effectMult,
            employmentEffect: val * 0.1 * effectMult,
            inflationEffect: val * 0.15 * effectMult,
            taxRevenueEffect: val * 0.3 * effectMult,
            stabilityEffect: val * 0.5 * effectMult
          };
        }
      };
    }
  } catch (err) {
    console.error("[Registry] Failed to fetch custom templates from DB:", err);
  }

  return decretals;
}
