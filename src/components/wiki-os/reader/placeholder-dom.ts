// src/components/wiki-os/reader/placeholder-dom.ts
// Turns an article's coordinate links, map embeds and stat templates into placeholder elements the
// reader mounts React widgets on. It works on the DOM: parse, replace nodes, serialize. The HTML it
// gets is already sanitized, and string surgery on sanitized HTML is not safe (the serializer leaves
// `<` and `>` unescaped in attribute values, so a regex that looks for `<a ...>(.*?)</a>` can be
// made to end inside an attribute and publish the rest of it as live markup).

import type { WikiSource } from "~/lib/wiki-os/config";
import {
  MAX_SISTER_EMBEDS,
  SISTER_EMBED_SELECTOR,
  sisterEmbedRequestOf,
  type SisterEmbedRequest,
} from "~/lib/wiki-os/sister-embed";
import { SISTER_EMBED_CLASS } from "~/lib/wiki-os/sister-dom";
import { parseInert } from "~/lib/wiki-os/transformers/inert-dom";
import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";

const COORDS_HREF = /Coords(?::|%3a)([^"|?#&]+)/i;
const MAP_EMBED_HREF = /MapEmbed(?::|%3a)([^"|?#&]+)/i;
const TEMPLATE_HREF = /Template(?::|%3a)([^"|?#&]+)/i;
const STAT_KEY = /^(?:MyCountry|CountryData|BusinessData):/;
/** `[[Coords:..]]`, `[[MapEmbed:..]]` (groups 1 to 3) or `{{MyCountry:..}}`-style stat templates (group 4). */
const RAW_PLACEHOLDER =
  /\[\[(Coords|MapEmbed):([^\]|]+)(?:\|([^\]]+))?\]\]|\{\{((?:MyCountry|CountryData|BusinessData):[^}\n]+?)\}\}/gi;

const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT

function coordsPlaceholder(document: Document, spec: string, label: string): HTMLElement {
  const [lat, lng, zoom] = safeDecodeURI(spec).split(",");
  const text = label || "Location";
  const element = document.createElement("span");
  element.className = "wikios-coords-placeholder";
  element.setAttribute("data-lat", lat || "0");
  element.setAttribute("data-lng", lng || "0");
  element.setAttribute("data-zoom", zoom || "4");
  element.setAttribute("data-label", text);
  element.textContent = text;
  return element;
}

function mapEmbedPlaceholder(document: Document, spec: string, options: string): HTMLElement {
  const [lat, lng, zoom] = safeDecodeURI(spec).split(",");
  const element = document.createElement("div");
  element.className = "wikios-map-embed-placeholder";
  element.setAttribute("data-lat", lat || "0");
  element.setAttribute("data-lng", lng || "0");
  element.setAttribute("data-zoom", zoom || "4");
  element.setAttribute("data-options", options);
  return element;
}

function statPlaceholder(document: Document, key: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "wikios-stat-placeholder";
  element.setAttribute("data-key", key);
  return element;
}

/** The placeholder a link stands for, or null when it is an ordinary link. */
function placeholderForLink(document: Document, anchor: Element): HTMLElement | null {
  const href = anchor.getAttribute("href") ?? "";
  const label = (anchor.textContent ?? "").trim();
  const coords = COORDS_HREF.exec(href)?.[1];
  if (coords) return coordsPlaceholder(document, coords, label);
  const mapEmbed = MAP_EMBED_HREF.exec(href)?.[1];
  if (mapEmbed) return mapEmbedPlaceholder(document, mapEmbed, label);
  const template = TEMPLATE_HREF.exec(href)?.[1];
  const key = template ? safeDecodeURI(template) : "";
  return STAT_KEY.test(key) ? statPlaceholder(document, key) : null;
}

/** `text` with each raw `[[Coords:..]]` / `{{CountryData:..}}` replaced by its placeholder, or null when it has none. */
function placeholdersInText(document: Document, text: string): DocumentFragment | null {
  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const match of text.matchAll(RAW_PLACEHOLDER)) {
    const [whole, kind, spec, label, statKey] = match;
    fragment.append(text.slice(last, match.index));
    if (statKey) fragment.append(statPlaceholder(document, statKey));
    else if (kind?.toLowerCase() === "coords") {
      fragment.append(coordsPlaceholder(document, spec ?? "", label ?? ""));
    } else fragment.append(mapEmbedPlaceholder(document, spec ?? "", label ?? ""));
    last = match.index + whole.length;
  }
  if (last === 0) return null;
  fragment.append(text.slice(last));
  return fragment;
}

function textNodesOf(document: Document, root: DocumentFragment): Text[] {
  const walker = document.createTreeWalker(root, SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement?.tagName;
    if (parent !== "SCRIPT" && parent !== "STYLE") nodes.push(node as Text);
  }
  return nodes;
}

/**
 * `html` with its coordinate links, map embeds and stat templates (links and raw `{{...}}` text)
 * replaced by placeholder elements, and its iframes removed. The DOM does the work; outside a
 * browser the HTML comes back untouched.
 */
export function injectPlaceholderElements(html: string): string {
  const parsed = parseInert(html);
  if (!parsed) return html;
  const { template, document, content } = parsed;

  for (const iframe of Array.from(content.querySelectorAll("iframe"))) iframe.remove();
  for (const anchor of Array.from(content.querySelectorAll("a[href]"))) {
    const placeholder = placeholderForLink(document, anchor);
    if (placeholder) anchor.replaceWith(placeholder);
  }
  for (const node of textNodesOf(document, content)) {
    const fragment = placeholdersInText(document, node.data);
    if (fragment) node.replaceWith(fragment);
  }

  // Serialized where it was parsed: the nodes never leave the inert template.
  return template.innerHTML;
}

/** The stat keys `html` asks for: stat placeholders, stat template links and raw stat templates. */
export function extractStatKeys(html: string): string[] {
  const parsed = parseInert(html);
  if (!parsed) return [];
  const { document, content } = parsed;

  const keys = new Set<string>();
  for (const element of Array.from(
    content.querySelectorAll(".wikios-stat-placeholder[data-key]")
  )) {
    keys.add(element.getAttribute("data-key") ?? "");
  }
  for (const anchor of Array.from(content.querySelectorAll("a[href]"))) {
    const template = TEMPLATE_HREF.exec(anchor.getAttribute("href") ?? "")?.[1];
    const key = template ? safeDecodeURI(template) : "";
    if (STAT_KEY.test(key)) keys.add(key);
  }
  for (const node of textNodesOf(document, content)) {
    for (const match of node.data.matchAll(RAW_PLACEHOLDER)) {
      if (match[4]) keys.add(match[4]);
    }
  }
  keys.delete("");
  return Array.from(keys);
}

/** A node of the live article the reader mounts a React widget on (`ArticleWidgetPortals`). */
export type PortalTarget =
  | {
      element: Element;
      type: "coords";
      data: { lat: number; lng: number; zoom: number; label: string };
    }
  | {
      element: Element;
      type: "map-embed";
      data: { lat: number; lng: number; zoom: number; options: string };
    }
  | { element: Element; type: "stat"; data: { key: string } }
  | { element: Element; type: "sister"; data: SisterEmbedRequest };

function mapAttrs(element: Element): { lat: number; lng: number; zoom: number } {
  return {
    lat: parseFloat(element.getAttribute("data-lat") || "0"),
    lng: parseFloat(element.getAttribute("data-lng") || "0"),
    zoom: parseInt(element.getAttribute("data-zoom") || "4", 10),
  };
}

/** The first `MAX_SISTER_EMBEDS` `Template:Sister` boxes that ask for an embed WikiOS can show, outside any embed. */
function sisterTargets(container: Element): PortalTarget[] {
  const targets: PortalTarget[] = [];
  for (const element of Array.from(container.querySelectorAll(SISTER_EMBED_SELECTOR))) {
    if (targets.length === MAX_SISTER_EMBEDS) break;
    if (element.closest(`.${SISTER_EMBED_CLASS}`)) continue;
    const request = sisterEmbedRequestOf(element);
    if (request) targets.push({ element, type: "sister", data: request });
  }
  return targets;
}

/**
 * The widget placeholders and `Template:Sister` boxes of the live article. Only an IxWiki page has any: another
 * wiki's page never mounts IxStates widgets or embeds (its HTML is that wiki's, read-only), so it has none.
 */
export function readPortalTargets(container: Element, source: WikiSource): PortalTarget[] {
  if (source !== "ixwiki") return [];
  const targets: PortalTarget[] = [];
  for (const element of Array.from(container.querySelectorAll(".wikios-coords-placeholder"))) {
    const label = element.getAttribute("data-label") || "Location";
    targets.push({ element, type: "coords", data: { ...mapAttrs(element), label } });
  }
  for (const element of Array.from(container.querySelectorAll(".wikios-map-embed-placeholder"))) {
    const options = element.getAttribute("data-options") || "";
    targets.push({ element, type: "map-embed", data: { ...mapAttrs(element), options } });
  }
  for (const element of Array.from(container.querySelectorAll(".wikios-stat-placeholder"))) {
    targets.push({ element, type: "stat", data: { key: element.getAttribute("data-key") || "" } });
  }
  return [...targets, ...sisterTargets(container)];
}
