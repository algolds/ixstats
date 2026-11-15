/** What a right-click (or a long-press, or the Menu key) landed on, as the system context menu reads it. */
export interface ContextTarget {
  /** Text the user had selected, when the click landed on it. */
  selection: string | null;
  /** The nearest link's absolute address. */
  link: string | null;
  /** That link's element, so "Open" can click it and keep whatever the link does on a click. */
  anchor: HTMLAnchorElement | null;
  /** The nation a `CountryLink` points at; `link` is then its profile. */
  country: { id?: string; slug?: string; name?: string } | null;
  /** The clicked image's address. */
  image: string | null;
  /** Ids of the areas the target sits in (`data-context-area`), innermost first. */
  areas: string[];
  /** Nothing specific was hit, so the menu is about the page: Back, Reload, Copy page link. */
  page: boolean;
}

/** The part of a `contextmenu` event the resolution reads. */
export interface ContextEventLike {
  target: EventTarget | null;
  /** 2 for the right mouse button; the keyboard (Menu key, Shift+F10) reports 0. */
  button: number;
  shiftKey: boolean;
  defaultPrevented: boolean;
  /** Chromium's `contextmenu` is a PointerEvent, so a long-press says "touch". */
  pointerType?: string;
}

/** Marks an element (and its subtree) that keeps the browser's own menu. */
export const NATIVE_CONTEXT_ATTR = "data-native-context-menu";
/** Marks an area that registered its own items with the system menu. */
export const CONTEXT_AREA_ATTR = "data-context-area";
/** The attributes `CountryLink` writes so the menu knows which nation a link is. */
export const COUNTRY_ATTRS = {
  id: "data-country-id",
  slug: "data-country-slug",
  name: "data-country-name",
} as const;

// Text entry keeps spellcheck and paste; canvases and maps draw their own menus; media and frames have
// browser controls; an open menu is not a place to open another. Dialogs, sheets and popovers keep the
// browser's menu too: the system menu renders outside them, so a click in it would dismiss them.
const KEEPS_NATIVE_MENU = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "canvas",
  ".maplibregl-map",
  "video",
  "audio",
  "iframe",
  "embed",
  "object",
  "[role='menu']",
  "[role='dialog']",
  "[role='alertdialog']",
  `[${NATIVE_CONTEXT_ATTR}]`,
].join(", ");

const COUNTRY_LINK = `a[${COUNTRY_ATTRS.id}], a[${COUNTRY_ATTRS.slug}]`;

function elementOf(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}

function countryOf(link: Element | null): ContextTarget["country"] {
  if (!link?.matches(COUNTRY_LINK)) return null;
  const read = (attr: string) => link.getAttribute(attr) || undefined;
  return {
    id: read(COUNTRY_ATTRS.id),
    slug: read(COUNTRY_ATTRS.slug),
    name: read(COUNTRY_ATTRS.name),
  };
}

function areasOf(el: Element): string[] {
  const areas: string[] = [];
  for (
    let area = el.closest(`[${CONTEXT_AREA_ATTR}]`);
    area;
    area = area.parentElement?.closest(`[${CONTEXT_AREA_ATTR}]`) ?? null
  ) {
    const id = area.getAttribute(CONTEXT_AREA_ATTR);
    if (id) areas.push(id);
  }
  return areas;
}

/** The selected text, when the click landed inside the selection; a click elsewhere is not about it. */
function selectionAt(el: Element, selection: Selection | null): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const within = selection.getRangeAt(0).commonAncestorContainer;
  return within.contains(el) || el.contains(within) ? text : null;
}

/**
 * Resolves a `contextmenu` event to what the system menu should offer, or `null` to leave the browser's
 * own menu alone: Shift+right-click, text fields, canvases and maps, media, overlays, an event a feature's
 * own context menu already took, and a touch long-press on plain text (which selects a word).
 */
export function resolveContextTarget(
  event: ContextEventLike,
  selection: Selection | null
): ContextTarget | null {
  if (event.defaultPrevented) return null;
  if (event.shiftKey && event.button === 2) return null;
  const el = elementOf(event.target);
  if (!el || el.closest(KEEPS_NATIVE_MENU)) return null;

  const anchor = el.closest<HTMLAnchorElement>("a[href]");
  const img = el.closest("img");
  const link = anchor?.href || null;
  const image = img?.currentSrc || img?.src || null;
  const selected = selectionAt(el, selection);
  if (event.pointerType === "touch" && !link && !image) return null;

  return {
    selection: selected,
    link,
    anchor: link ? anchor : null,
    country: countryOf(anchor),
    image,
    areas: areasOf(el),
    page: !link && !image && !selected,
  };
}

/** A nation's profile path, the address "Open profile" goes to whatever the link's own href is. */
export function countryProfilePath(country: { id?: string; slug?: string }): string {
  return `/countries/${encodeURIComponent(country.slug ?? country.id ?? "")}`;
}
