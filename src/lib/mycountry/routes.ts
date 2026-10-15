/**
 * MyCountry destinations other apps link to. Plain paths: Next's `<Link>` and router add the base
 * path themselves.
 */

export const MYCOUNTRY_PATH = "/mycountry";

/** Where the founding flow sends a player once their nation exists. */
export const MYCOUNTRY_WELCOME_PATH = "/mycountry/welcome";

/** The Economy section's tabs, as `?tab=` takes them. */
export const ECONOMY_TABS = ["macro", "fiscal", "monetary", "trade"] as const;
export type EconomyTab = (typeof ECONOMY_TABS)[number];

export function isEconomyTab(value: string | null | undefined): value is EconomyTab {
  return ECONOMY_TABS.includes(value as EconomyTab);
}

/** The Economy section opened on one tab ("fiscal" is National budget, "monetary" Fiscal policy). */
export function economyTabHref(tab: EconomyTab): string {
  return `/mycountry/economy?tab=${tab}`;
}

/** The National budget console. */
export const MYCOUNTRY_BUDGET_PATH = economyTabHref("fiscal");
/** The Fiscal policy console, where tax rates are set. */
export const MYCOUNTRY_TAX_PATH = economyTabHref("monetary");
/** The Politics section, which opens on the cabinet. */
export const MYCOUNTRY_CABINET_PATH = "/mycountry/politics";
/** The nation's map editor, where cities (the capital among them) are placed. */
export const MYCOUNTRY_MAP_EDITOR_PATH = "/mycountry/map-editor";
