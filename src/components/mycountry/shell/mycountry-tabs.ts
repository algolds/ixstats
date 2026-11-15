import { Building, Community, Crown, Globe, Shield, StatsReport } from "iconoir-react";
import type { RibbonTab } from "~/components/shared/document/DocumentRibbon";
import type { MyCountrySection } from "./mycountry-sections";

/** The sections the command ribbon lists (Intelligence folds into Defense; the map editor is its own page). */
export type MyCountryTab = Extract<
  MyCountrySection,
  "overview" | "executive" | "economy" | "diplomacy" | "politics" | "defense"
>;

/**
 * The MyCountry command ribbon: the app's one section navigation (the sidebar lists the app
 * only). Same order and labels the sidebar used, so muscle memory carries over.
 */
export const MYCOUNTRY_TABS: readonly RibbonTab<MyCountryTab>[] = [
  { id: "overview", label: "Overview", icon: Crown },
  { id: "executive", label: "Directives", icon: Building },
  { id: "economy", label: "Economy", icon: StatsReport },
  { id: "diplomacy", label: "Diplomacy", icon: Globe },
  { id: "politics", label: "Politics", icon: Community },
  { id: "defense", label: "Defense", icon: Shield },
];

/**
 * The ribbon tabs a player sees: Defense only with MyCountry Premium or as a beta tester (the
 * page keeps its premium preview for anyone who arrives by URL).
 */
export function visibleTabs(hasDefense: boolean): readonly RibbonTab<MyCountryTab>[] {
  return hasDefense ? MYCOUNTRY_TABS : MYCOUNTRY_TABS.filter((tab) => tab.id !== "defense");
}

const isTab = (section: string): section is MyCountryTab =>
  MYCOUNTRY_TABS.some((tab) => tab.id === section);

/** The tab a section highlights; `/mycountry/intelligence` and the map editor keep their parent's. */
export function tabForSection(section: string): MyCountryTab {
  if (section === "intelligence") return "defense";
  return isTab(section) ? section : "overview";
}
