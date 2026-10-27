import { COMPLIANCE_GOVERNMENT_TYPE, COMPLIANCE_NO_GOVERNMENT } from "./compliance";

/**
 * MyCountry destinations other apps link to. Plain paths: Next's `<Link>` and router add the base
 * path themselves.
 */

export const MYCOUNTRY_PATH = "/mycountry";

/** Where the founding flow sends a player once their nation exists. */
export const MYCOUNTRY_WELCOME_PATH = "/mycountry/welcome";

/** The Economy section's tabs, as `?tab=` takes them. */
export const ECONOMY_TABS = ["report", "budget", "taxes", "trade"] as const;
export type EconomyTab = (typeof ECONOMY_TABS)[number];

/** Tab ids older links carry: "fiscal" was the budget, "monetary" the tax rates. */
const LEGACY_ECONOMY_TABS: Record<string, EconomyTab> = {
  macro: "report",
  fiscal: "budget",
  monetary: "taxes",
};

/** The tab a `?tab=` value opens (old ids included), or null when it names none. */
export function economyTabFromParam(value: string | null | undefined): EconomyTab | null {
  if (!value) return null;
  if ((ECONOMY_TABS as readonly string[]).includes(value)) return value as EconomyTab;
  return LEGACY_ECONOMY_TABS[value] ?? null;
}

/** The Economy section opened on one tab. */
export function economyTabHref(tab: EconomyTab): string {
  return `/mycountry/economy?tab=${tab}`;
}

/** The National budget console. */
export const MYCOUNTRY_BUDGET_PATH = economyTabHref("budget");
/** The tax rates console, where tax rates are set. */
export const MYCOUNTRY_TAX_PATH = economyTabHref("taxes");
/** The Politics section, which opens on the cabinet. */
export const MYCOUNTRY_CABINET_PATH = "/mycountry/politics";
/** The nation's map editor, where cities (the capital among them) are placed. */
export const MYCOUNTRY_MAP_EDITOR_PATH = "/mycountry/map-editor";

/** The country editor: identity, government and size, each section saved on its own. */
export const MYCOUNTRY_EDITOR_PATH = "/mycountry/editor";

/**
 * Editor anchors: the four groups (`identity`, `government`, `size`, `elsewhere`) and the
 * sections inside them.
 */
export const EDITOR_ANCHORS = [
  "identity",
  "name",
  "symbols",
  "language",
  "culture",
  "civic",
  "government",
  "form",
  "institutions",
  "size",
  "population",
  "elsewhere",
  "consoles",
] as const;
export type EditorAnchor = (typeof EDITOR_ANCHORS)[number];

/** The editor opened at one group or section ("/mycountry/editor#government"). */
export function editorHref(anchor: EditorAnchor): string {
  return `${MYCOUNTRY_EDITOR_PATH}#${anchor}`;
}

/** The Economy section, which opens on its overview. */
export const MYCOUNTRY_ECONOMY_PATH = "/mycountry/economy";

/**
 * Where the profile checklist's Review goes for its first incomplete section: identity and the
 * form of government are edited in the editor, departments and allocations in the Budget tab, tax
 * rates in the Taxes tab.
 */
export function complianceReviewHref(
  section: { id: string; missing: readonly string[] } | undefined
): string {
  switch (section?.id) {
    case "government": {
      const needsEditor = section.missing.some(
        (item) => item === COMPLIANCE_GOVERNMENT_TYPE || item === COMPLIANCE_NO_GOVERNMENT
      );
      return needsEditor ? editorHref("government") : MYCOUNTRY_BUDGET_PATH;
    }
    case "taxes":
      return MYCOUNTRY_TAX_PATH;
    default:
      return editorHref("identity");
  }
}
