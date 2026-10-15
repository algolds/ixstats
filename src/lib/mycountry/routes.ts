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
 * government type are edited in the editor, budget, economy and taxes in their consoles.
 */
export function complianceReviewHref(
  section: { id: string; missing: readonly string[] } | undefined
): string {
  switch (section?.id) {
    case "government": {
      const needsEditor = section.missing.some(
        (item) => item === "Government type" || item.startsWith("Create a government structure")
      );
      return needsEditor ? editorHref("government") : MYCOUNTRY_BUDGET_PATH;
    }
    case "economy":
      return MYCOUNTRY_ECONOMY_PATH;
    case "taxes":
      return MYCOUNTRY_TAX_PATH;
    default:
      return editorHref("identity");
  }
}
