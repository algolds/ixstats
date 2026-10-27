import { stripBasePath } from "~/lib/base-path";

export type MyCountrySection =
  | "overview"
  | "executive"
  | "economy"
  | "diplomacy"
  | "intelligence"
  | "defense"
  | "politics"
  | "map-editor";

/** Pathname prefix → section, checked in order. Intelligence is folded into Defense. */
const SECTION_PREFIXES: Array<[prefix: string, section: MyCountrySection]> = [
  ["/mycountry/map-editor", "map-editor"],
  ["/mycountry/executive", "executive"],
  ["/mycountry/economy", "economy"],
  ["/mycountry/intelligence", "defense"],
  ["/mycountry/diplomacy", "diplomacy"],
  ["/mycountry/defense", "defense"],
  ["/mycountry/politics", "politics"],
];

export function getSectionFromPathname(rawPathname: string): MyCountrySection {
  const pathname = stripBasePath(rawPathname);
  return SECTION_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "overview";
}
