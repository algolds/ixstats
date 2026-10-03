import { Globe as Globe2, Shield, Bank as Landmark, StatUp as TrendingUp } from "iconoir-react";

/** The four domain drill-downs, shared by the drill sheets and the full-page domain surfaces. */
export type MyCountryDomain = "relations" | "defense" | "politics" | "economy";

export const DOMAIN_META: Record<
  MyCountryDomain,
  {
    title: string;
    sheetTitle: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
    blurb: string;
    section: "diplomacy" | "defense" | "politics" | "economy";
    href: string;
    prefilledGoal: string;
  }
> = {
  relations: {
    title: "Diplomacy",
    sheetTitle: "Foreign relations",
    icon: Globe2,
    blurb: "Relations, embassies, alliances and trade agreements.",
    section: "diplomacy",
    href: "/mycountry/diplomacy",
    prefilledGoal: "Fund foreign ministry diplomatic consular service and trade promotion",
  },
  defense: {
    title: "Defense",
    sheetTitle: "National security",
    icon: Shield,
    blurb: "Forces, readiness and regional threats.",
    section: "defense",
    href: "/mycountry/defense",
    prefilledGoal: "Strengthen national defense and military readiness",
  },
  politics: {
    title: "Politics",
    sheetTitle: "Governance configuration",
    icon: Landmark,
    blurb: "Legislation, factions, governance and elections.",
    section: "politics",
    href: "/mycountry/politics",
    prefilledGoal: "Reform domestic governance and political institutions",
  },
  economy: {
    title: "Economy & budget",
    sheetTitle: "Economy & budget",
    icon: TrendingUp,
    blurb: "Budget, taxes, trade and growth.",
    section: "economy",
    href: "/mycountry/economy",
    prefilledGoal: "Stabilize the national economy and improve the fiscal outlook",
  },
};

export const DOMAIN_SECTIONS: ReadonlySet<string> = new Set([
  "diplomacy",
  "defense",
  "politics",
  "economy",
  "executive",
]);

export function isDomainSection(section?: string): boolean {
  return section ? DOMAIN_SECTIONS.has(section) : false;
}
