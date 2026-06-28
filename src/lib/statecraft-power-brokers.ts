import { ComponentType } from "@prisma/client";

export interface PowerBrokerDefinition {
  id: string;
  name: string;
  description: string;
  requiredComponents: ComponentType[];
  spendCategories: string[];
  minSpendPercent: number;
  bonusDescription: string;
}

export interface ActiveBroker {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  satisfied: boolean;
  currentSpend: number;
  requiredSpend: number;
  gapPercent: number;
  bonusDescription: string;
}

export const POWER_BROKERS: PowerBrokerDefinition[] = [
  {
    id: "technocrats",
    name: "The Technocrats",
    description: "A coalition of senior civil servants, scientific advisors, and planning experts.",
    requiredComponents: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES],
    spendCategories: ["Science&Tech", "Education", "Commerce"],
    minSpendPercent: 15.0,
    bonusDescription: "-15% domestic policy upkeep (Capacity relief)"
  },
  {
    id: "party",
    name: "The Party",
    description: "The core partisan machinery and loyal political apparatus.",
    requiredComponents: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.OLIGARCHIC_PROCESS],
    spendCategories: ["Interior", "Intelligence", "Justice"],
    minSpendPercent: 15.0,
    bonusDescription: "+10% political stability and +5% leading party support drift"
  },
  {
    id: "generals",
    name: "The Generals",
    description: "The military command council and national defense establishment.",
    requiredComponents: [ComponentType.MILITARY_ADMINISTRATION], // fallback to MILITARY_ENFORCEMENT handled dynamically
    spendCategories: ["Defense"],
    minSpendPercent: 15.0,
    bonusDescription: "+10% military readiness (-5% political stability if Defense spend > 30%)"
  },
  {
    id: "magnates",
    name: "The Magnates",
    description: "The industrial giants, commerce chambers, and private enterprise consortiums.",
    requiredComponents: [ComponentType.OLIGARCHIC_PROCESS, ComponentType.ECONOMIC_INCENTIVES],
    spendCategories: ["Commerce", "Energy"],
    minSpendPercent: 15.0,
    bonusDescription: "+0.5% GDP growth modifier (-3% political stability due to social tension)"
  },
  {
    id: "clergy",
    name: "The Clergy",
    description: "The religious leaders, traditional councils, and moral guardians.",
    requiredComponents: [ComponentType.RELIGIOUS_LEGITIMACY], // fallback to TRADITIONAL_LEGITIMACY handled dynamically
    spendCategories: ["Culture"],
    minSpendPercent: 15.0,
    bonusDescription: "+5% political stability"
  }
];

export function deriveBrokers(
  activeComponents: ComponentType[],
  spendByCategory: Record<string, number>
): ActiveBroker[] {
  const componentSet = new Set(activeComponents);

  return POWER_BROKERS.map((def) => {
    // Handle fallback/OR unlocks for Generals and Clergy
    let unlocked = false;
    if (def.id === "generals") {
      unlocked = componentSet.has(ComponentType.MILITARY_ADMINISTRATION) || 
                 componentSet.has(ComponentType.MILITARY_ENFORCEMENT);
    } else if (def.id === "clergy") {
      unlocked = componentSet.has(ComponentType.RELIGIOUS_LEGITIMACY) || 
                 componentSet.has(ComponentType.TRADITIONAL_LEGITIMACY);
    } else {
      unlocked = def.requiredComponents.every((c) => componentSet.has(c));
    }

    // Calculate total spend on the broker's favored categories
    let currentSpend = 0;
    def.spendCategories.forEach((cat) => {
      currentSpend += spendByCategory[cat] || 0;
    });

    const requiredSpend = def.minSpendPercent;
    const satisfied = unlocked && currentSpend >= requiredSpend;
    const gapPercent = Math.max(0, requiredSpend - currentSpend);

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      unlocked,
      satisfied,
      currentSpend: Math.round(currentSpend * 100) / 100,
      requiredSpend,
      gapPercent: Math.round(gapPercent * 100) / 100,
      bonusDescription: def.bonusDescription
    };
  });
}
