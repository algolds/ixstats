import { Globe as Globe2, Shield, Bank as Landmark, StatUp as TrendingUp } from "iconoir-react";

/**
 * Single source of truth for the four v2 domain drill-downs.
 * Shared by the right-side drill sheets (V2DrillSheets) and the full-page
 * domain surfaces (V2DomainSurface) so theming stays consistent.
 */
export type V2Domain = "relations" | "defense" | "politics" | "economy";

export const DOMAIN_META: Record<
  V2Domain,
  {
    title: string;
    sheetTitle: string;
    icon: any;
    accent: string;
    blurb: string;
    section: "diplomacy" | "defense" | "politics" | "economy";
    href: string;
    prefilledGoal: string;
  }
> = {
  relations: {
    title: "Diplomacy",
    sheetTitle: "Foreign Relations",
    icon: Globe2,
    accent: "text-teal-400",
    blurb:
      "Forge alliances, establish embassies, negotiate trade pacts, and project diplomatic influence",
    section: "diplomacy",
    href: "/mycountry/diplomacy",
    prefilledGoal: "Advance our foreign policy and strengthen diplomatic relations",
  },
  defense: {
    title: "Defense",
    sheetTitle: "National Security",
    icon: Shield,
    accent: "text-red-400",
    blurb:
      "Deploy military forces, monitor regional threat vectors, fortify defenses, and maintain strategic warfare readiness.",
    section: "defense",
    href: "/mycountry/defense",
    prefilledGoal: "Strengthen national defense and military readiness",
  },
  politics: {
    title: "Politics",
    sheetTitle: "Governance Configuration",
    icon: Landmark,
    accent: "text-purple-400",
    blurb:
      "Enact legislative policies, manage political faction dynamics, shape governance structures, and secure electoral dominance.",
    section: "politics",
    href: "/mycountry/politics",
    prefilledGoal: "Reform domestic governance and political institutions",
  },
  economy: {
    title: "Economy & Budget",
    sheetTitle: "Economy & Budget",
    icon: TrendingUp,
    accent: "text-emerald-400",
    blurb:
      "Manage national budget allocation, optimize trade revenue, control inflation, and build a booming powerhouse economy.",
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
