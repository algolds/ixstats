/**
 * The drawn shield as plain data, shared by the live editor (ShieldRenderer, React) and the
 * server-side image render (serializeShieldSvg → sharp). Both draw from one scene so the stored
 * coat-of-arms image matches what the editor showed.
 *
 * Not exported from the `~/lib/heraldry` barrel: it pulls in the SVG sanitizer (jsdom on the server).
 */
import type { HeraldryComposition } from "./types";
import { computeLayout } from "./layout";
import {
  renderShieldOutline,
  renderDivisionPaths,
  renderOrdinaryPath,
  getTinctureColor,
} from "./svg-utils";
import { CHARGE_PATHS } from "./charge-paths";
import { sanitizeSvgMarkup } from "~/lib/utils/sanitize-html";

/** The editor's full canvas. The shield itself sits in the 250..750 box. */
export const SHIELD_VIEWBOX = "0 0 1000 1000";
/** Tight framing for stored images: the shield plus its outline stroke and drop shadow. */
export const SHIELD_IMAGE_VIEWBOX = "200 200 600 600";

export const SHIELD_SHADOW = {
  dx: 0,
  dy: 8,
  stdDeviation: 12,
  floodColor: "#000000",
  floodOpacity: 0.45,
} as const;

/** Outline strokes, drawn in order (dark rim, then gold edge). */
export const SHIELD_STROKES = [
  { color: "#1e1b4b", width: 14 },
  { color: "#f59e0b", width: 6 },
] as const;

/** Stand-in shape for a charge with no template and no loaded SVG. */
const STAR_PATH = CHARGE_PATHS.star ?? "";

type Rect = { x: number; y: number; width: number; height: number };

export interface SceneFieldPiece {
  path?: string;
  rect?: Rect;
  color: string;
}

export interface SceneOrdinary {
  /** Index into composition.shield.ordinaries (unknown ordinary types are skipped). */
  index: number;
  d: string;
  fill: string;
}

export type SceneCharge =
  | {
      kind: "custom";
      key: string;
      /** Index into composition.shield.charges (a ref expands to `count` instances). */
      refIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      /** Sanitized inner SVG markup of the charge, drawn in a 0 0 100 100 viewport. */
      markup: string;
    }
  | {
      kind: "path";
      key: string;
      refIndex: number;
      d: string;
      fill: string;
      /** True when the charge is unknown and drawn as a star stand-in. */
      placeholder: boolean;
      transform: string;
    };

export interface ShieldScene {
  clipId: string;
  outline: string;
  field: SceneFieldPiece[];
  ordinaries: SceneOrdinary[];
  charges: SceneCharge[];
}

/**
 * Sanitizes an SVG document and returns only its children (the outer <svg> tag removed), with
 * every external reference dropped so the shield is self-contained: <image>/<feImage> elements,
 * href/xlink:href values that are not in-document "#fragment" links, and CSS @import rules.
 */
export function innerSvgMarkup(svg: string): string {
  const clean = sanitizeSvgMarkup(svg)
    .replace(/<(image|feimage)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1\s*>)/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*"(?!#)[^"]*"/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*'(?!#)[^']*'/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .trim();
  const open = clean.match(/^<svg\b[^>]*>/i);
  if (!open) return clean;
  const body = clean.slice(open[0].length);
  const close = body.toLowerCase().lastIndexOf("</svg>");
  return close === -1 ? body : body.slice(0, close);
}

export function buildShieldScene(
  composition: HeraldryComposition,
  customChargeSvgs: Record<string, string> = {}
): ShieldScene {
  const { charges } = computeLayout(composition);
  const chargeRefs = composition.shield.charges ?? [];
  const chargeOwner = chargeRefs.flatMap((ref, i) => Array.from({ length: ref.count }, () => i));
  const innerCache = new Map<string, string>();

  return {
    clipId: `shield-clip-${composition.shield.shape}`,
    outline: renderShieldOutline(composition.shield.shape),
    field: renderDivisionPaths(
      composition.shield.field.division,
      composition.shield.field.tinctures
    ),
    ordinaries: (composition.shield.ordinaries ?? []).flatMap((ord, index) => {
      const d = renderOrdinaryPath(ord.type);
      return d ? [{ index, d, fill: getTinctureColor(ord.tincture) }] : [];
    }),
    charges: charges.flatMap((layoutCharge, idx): SceneCharge[] => {
      const refIndex = chargeOwner[idx] ?? 0;
      const chargeRef = chargeRefs[refIndex];
      if (!chargeRef) return [];

      const customSvg = customChargeSvgs[chargeRef.chargeId];
      if (customSvg) {
        let markup = innerCache.get(chargeRef.chargeId);
        if (markup === undefined) {
          markup = innerSvgMarkup(customSvg);
          innerCache.set(chargeRef.chargeId, markup);
        }
        return [
          {
            kind: "custom",
            key: layoutCharge.id,
            refIndex,
            x: layoutCharge.x - layoutCharge.width / 2,
            y: layoutCharge.y - layoutCharge.height / 2,
            width: layoutCharge.width,
            height: layoutCharge.height,
            markup,
          },
        ];
      }

      const template = CHARGE_PATHS[chargeRef.chargeId];
      return [
        {
          kind: "path",
          key: layoutCharge.id,
          refIndex,
          d: template ?? STAR_PATH,
          fill: getTinctureColor(chargeRef.tincture),
          placeholder: !template,
          transform: `translate(${layoutCharge.x}, ${layoutCharge.y}) scale(${layoutCharge.width / 100})`,
        },
      ];
    }),
  };
}

/** Escapes a value for a double-quoted XML attribute. */
function attr(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The scene as a standalone SVG document (no scripts, no external references: custom charges are
 * inlined after sanitizing). `size` sets the pixel width/height a rasterizer renders at.
 */
export function serializeShieldSvg(
  scene: ShieldScene,
  { viewBox = SHIELD_VIEWBOX, size }: { viewBox?: string; size?: number } = {}
): string {
  const dims = size ? ` width="${attr(size)}" height="${attr(size)}"` : "";
  const field = scene.field
    .map((piece) =>
      piece.rect
        ? `<rect x="${attr(piece.rect.x)}" y="${attr(piece.rect.y)}" width="${attr(piece.rect.width)}" height="${attr(piece.rect.height)}" fill="${attr(piece.color)}"/>`
        : `<path d="${attr(piece.path ?? "")}" fill="${attr(piece.color)}"/>`
    )
    .join("");
  const ordinaries = scene.ordinaries
    .map((ord) => `<path d="${attr(ord.d)}" fill="${attr(ord.fill)}"/>`)
    .join("");
  const charges = scene.charges
    .map((charge) =>
      charge.kind === "custom"
        ? `<svg x="${attr(charge.x)}" y="${attr(charge.y)}" width="${attr(charge.width)}" height="${attr(charge.height)}" viewBox="0 0 100 100">${xmlSafe(charge.markup)}</svg>`
        : `<path d="${attr(charge.d)}" fill="${attr(charge.fill)}"${charge.placeholder ? ' opacity="0.85"' : ""} transform="${attr(charge.transform)}"/>`
    )
    .join("");
  const strokes = SHIELD_STROKES.map(
    (s) =>
      `<path d="${attr(scene.outline)}" fill="none" stroke="${attr(s.color)}" stroke-width="${attr(s.width)}"/>`
  ).join("");
  const sh = SHIELD_SHADOW;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${attr(viewBox)}"${dims}>` +
    `<defs><clipPath id="${attr(scene.clipId)}"><path d="${attr(scene.outline)}"/></clipPath>` +
    `<filter id="shield-shadow" x="-10%" y="-10%" width="130%" height="130%">` +
    `<feDropShadow dx="${sh.dx}" dy="${sh.dy}" stdDeviation="${sh.stdDeviation}" flood-color="${sh.floodColor}" flood-opacity="${sh.floodOpacity}"/>` +
    `</filter></defs>` +
    `<g filter="url(#shield-shadow)"><g clip-path="url(#${attr(scene.clipId)})">` +
    `<g>${field}</g><g>${ordinaries}</g><g>${charges}</g>` +
    `</g>${strokes}</g></svg>`
  );
}

/**
 * The sanitizer returns HTML-serialized markup; the one HTML-only entity it emits (`&nbsp;`) is not
 * defined in XML, so rasterizers would reject the document.
 */
function xmlSafe(markup: string): string {
  return markup.replace(/&nbsp;/g, "&#160;");
}
