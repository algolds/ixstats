import { COMPLIANCE_GOVERNMENT_TYPE, COMPLIANCE_NO_GOVERNMENT } from "./compliance";

/**
 * MyCountry destinations other apps link to. Plain paths: Next's `<Link>` and router add the base
 * path themselves.
 */

export const MYCOUNTRY_PATH = "/mycountry";

/** Where the founding flow sends a player once their nation exists. */
export const MYCOUNTRY_WELCOME_PATH = "/mycountry/welcome";

/** The Economy section's tabs, as `?tab=` takes them. */
export const ECONOMY_TABS = ["report", "budget", "taxes", "trade", "corporations"] as const;
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

/**
 * Editor panes in the Country Editor Facet Studio, plus legacy and sub-section `#hash` anchors
 * that resolve into those panes.
 */
export const EDITOR_PANES = [
  "identity",
  "constitution",
  "cabinet",
  "scale",
  "taxes",
  "budget",
] as const;
export type EditorPane = (typeof EDITOR_PANES)[number];

export const EDITOR_ANCHORS = [
  "identity",
  "name",
  "symbols",
  "language",
  "culture",
  "civic",
  "constitution",
  "government",
  "form",
  "legislature",
  "institutions",
  "cabinet",
  "parties",
  "scale",
  "size",
  "population",
  "figures",
  "taxes",
  "trade",
  "tariffs",
  "budget",
  "elsewhere",
  "consoles",
] as const;
export type EditorAnchor = (typeof EDITOR_ANCHORS)[number];

const ANCHOR_TO_PANE: Record<EditorAnchor, EditorPane> = {
  identity: "identity",
  name: "identity",
  symbols: "identity",
  language: "identity",
  culture: "identity",
  civic: "identity",
  constitution: "constitution",
  government: "constitution",
  form: "constitution",
  legislature: "constitution",
  institutions: "constitution",
  cabinet: "cabinet",
  parties: "cabinet",
  scale: "scale",
  size: "scale",
  population: "scale",
  figures: "scale",
  taxes: "taxes",
  trade: "taxes",
  tariffs: "taxes",
  budget: "budget",
  elsewhere: "taxes",
  consoles: "taxes",
};

/** Resolves any `#hash` or section id to its owning Country Editor studio pane. */
export function resolveEditorPane(anchor: string | null | undefined): EditorPane {
  if (!anchor) return "identity";
  const clean = anchor.replace(/^#/, "");
  return ANCHOR_TO_PANE[clean as EditorAnchor] ?? "identity";
}

/** The country editor: identity, constitution, cabinet, scale, taxes and budget. */
export const MYCOUNTRY_EDITOR_PATH = "/mycountry/editor";

/** The editor opened at one pane or section ("/mycountry/editor#taxes"). */
export function editorHref(anchor: EditorAnchor): string {
  return `${MYCOUNTRY_EDITOR_PATH}#${anchor}`;
}

/** The National budget studio pane in the country editor. */
export const MYCOUNTRY_BUDGET_PATH = editorHref("budget");
/** The tax rates studio pane in the country editor. */
export const MYCOUNTRY_TAX_PATH = editorHref("taxes");
/** The cabinet studio pane in the country editor. */
export const MYCOUNTRY_CABINET_PATH = editorHref("cabinet");
/** The nation's map editor, where cities (the capital among them) are placed. */
export const MYCOUNTRY_MAP_EDITOR_PATH = "/mycountry/map-editor";

/** The Economy section, which opens on its overview. */
export const MYCOUNTRY_ECONOMY_PATH = "/mycountry/economy";

/**
 * Where the profile checklist's Review goes for its first incomplete section: every nation setup
 * step lives in `/mycountry/editor` on its corresponding studio pane.
 */
export function complianceReviewHref(
  section: { id: string; missing: readonly string[] } | undefined
): string {
  switch (section?.id) {
    case "government": {
      const needsConstitution = section.missing.some(
        (item) => item === COMPLIANCE_GOVERNMENT_TYPE || item === COMPLIANCE_NO_GOVERNMENT
      );
      return needsConstitution ? editorHref("constitution") : MYCOUNTRY_BUDGET_PATH;
    }
    case "taxes":
      return MYCOUNTRY_TAX_PATH;
    default:
      return editorHref("identity");
  }
}
