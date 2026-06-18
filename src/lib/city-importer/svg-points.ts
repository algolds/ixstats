// Server-only: imports @xmldom/xmldom via the province-importer SVG pipeline. Never import into a client component or hook.

import { DOMParser } from "@xmldom/xmldom";
import { elementToRings, SHAPE_TAGS } from "../province-importer/svg-element-converter";
import {
  getAccumulatedTransform,
  applyMatrixToPoint,
  applyMatrixToRings,
} from "../province-importer/svg-transform";
import {
  detectProvinceLayer,
  collectShapeElements,
  filterProvinceShapes,
} from "../province-importer/svg-layer-detector";
import { extractAllTextLabels } from "../province-importer/svg-text-matcher";

const SVG_NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

export interface SvgLayerInfo {
  id: string; // element id or a synthesized id (e.g. "layer-3")
  name: string; // inkscape:label / id / "Layer N"
  shapeCount: number;
  textCount: number;
  /** Circles, ellipses, <use> refs, and small point-like shapes — the actual city markers. */
  markerCount: number;
  /** Nesting depth (0 = top-level child of <svg>) for UI indentation. */
  depth: number;
}

export interface SvgCityPoint {
  svgX: number; // in root SVG coordinate space (after getAccumulatedTransform)
  svgY: number;
  name: string; // matched text label, or "" if none
  isCapital: boolean;
}

export interface SvgProvinceRef {
  name: string; // province label text
  svgX: number; // province shape centroid in root SVG space
  svgY: number;
}

export interface ParsedCitySvg {
  layers: SvgLayerInfo[];
  points: SvgCityPoint[];
  svgProvinces: SvgProvinceRef[];
  detectedCitiesLayerId: string;
  detectedCityNameLayerId?: string;
}

export interface ParseCitySvgOptions {
  citiesLayerId?: string; // which layer holds the dots; auto-detect if unset
  capitalLayerId?: string; // layer (or marker) that marks capitals; optional
  cityNameLayerId?: string; // layer holding city names/labels; optional
}

function sanitizeSvg(svgContent: string): string {
  return svgContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "")
    .replace(/xlink:href\s*=\s*"https?:\/\/[^"]*"/gi, "")
    .replace(/xlink:href\s*=\s*'https?:\/\/[^']*'/gi, "");
}

function extractViewBox(svgRoot: Element): { width: number; height: number } {
  const viewBoxAttr = svgRoot.getAttribute("viewBox");
  let w = 0;
  let h = 0;
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      w = parts[2]!;
      h = parts[3]!;
    }
  }
  if (w === 0) {
    w = parseFloat(svgRoot.getAttribute("width") || "0");
    h = parseFloat(svgRoot.getAttribute("height") || "0");
  }
  return { width: w || 800, height: h || 600 };
}

function isPointLikeElement(el: Element, viewBoxWidth: number, _viewBoxHeight: number): boolean {
  const tag = el.localName ?? el.tagName?.split(":").pop() ?? "";
  if (tag === "circle" || tag === "ellipse") {
    const r = parseFloat(el.getAttribute("r") ?? el.getAttribute("rx") ?? "0");
    return r > 0 && r <= 15;
  }
  try {
    const rings = elementToRings(el);
    if (rings.length === 0 || rings[0]!.length === 0) return false;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const maxDim = Math.max(viewBoxWidth * 0.05, 30);
    return w > 0 && h > 0 && w <= maxDim && h <= maxDim;
  } catch {
    return false;
  }
}

// Count point-like markers (circles, ellipses, <use>, small shapes) by walking
// the DOM directly. Unlike collectShapeElements, this does NOT drop shapes that
// lack an inline fill= (city dots are usually styled via CSS class / default fill),
// which is exactly the case collectShapeElements wrongly discards.
function countPointLikeDescendants(
  el: Element,
  viewBoxWidth: number,
  viewBoxHeight: number
): number {
  let count = 0;
  const walk = (node: Element) => {
    const tag = node.localName ?? node.tagName?.split(":").pop() ?? "";
    if (tag === "circle" || tag === "ellipse" || tag === "use") {
      count++;
      return;
    }
    if (SHAPE_TAGS.has(tag)) {
      if (isPointLikeElement(node, viewBoxWidth, viewBoxHeight)) count++;
      return;
    }
    if (tag === "g") {
      const children = node.childNodes;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as Element;
        if (child && child.nodeType === 1) walk(child);
      }
    }
  };
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child && child.nodeType === 1) walk(child);
  }
  return count;
}

function findLayerByIdOrName(svgRoot: Element, idOrName: string): Element | null {
  if (idOrName === "root") return svgRoot;
  const allG = svgRoot.getElementsByTagNameNS(SVG_NS, "g");
  for (let i = 0; i < allG.length; i++) {
    const g = allG[i]!;
    const id = g.getAttribute("id");
    const label = g.getAttributeNS(INKSCAPE_NS, "label") || g.getAttribute("inkscape:label");
    if (id === idOrName || label === idOrName) {
      return g;
    }
  }
  return null;
}

function isDescendantOfIdOrName(el: Element, idOrName: string): boolean {
  let current: any = el;
  while (current) {
    if (current.nodeType === 1 && typeof current.getAttribute === "function") {
      const id = current.getAttribute("id");
      const label =
        current.getAttributeNS(INKSCAPE_NS, "label") || current.getAttribute("inkscape:label");
      if (id === idOrName || label === idOrName) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function hasCapitalAncestor(el: Element): boolean {
  let current: any = el;
  while (current) {
    if (current.nodeType === 1 && typeof current.getAttribute === "function") {
      const id = current.getAttribute("id") || "";
      const label =
        current.getAttributeNS(INKSCAPE_NS, "label") ||
        current.getAttribute("inkscape:label") ||
        "";
      if (/capital/i.test(id) || /capital/i.test(label)) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function detectProvinceName(el: Element, fallbackId: string): { name: string } {
  const label = el.getAttributeNS(INKSCAPE_NS, "label") || el.getAttribute("inkscape:label");
  if (label) return { name: label };
  const dataName =
    el.getAttribute("data-name") || el.getAttribute("aria-label") || el.getAttribute("title");
  if (dataName) return { name: dataName };
  const id = el.getAttribute("id");
  if (id) return { name: id };
  return { name: fallbackId };
}

export function parseCitySvg(svgContent: string, opts?: ParseCitySvgOptions): ParsedCitySvg {
  const sanitized = sanitizeSvg(svgContent);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    throw new Error("Failed to parse SVG: no root element found");
  }

  const viewBox = extractViewBox(svgRoot);

  // 1. Enumerate layers — recursively walk ALL named <g> groups so nested
  //    groups (e.g. Labels > Province_Names) appear in the layer picker.
  const layers: SvgLayerInfo[] = [];
  const seenIds = new Set<string>();
  let syntheticIdx = 0;

  const enumerateGroups = (parent: Element, depth: number) => {
    const ch = parent.childNodes;
    for (let i = 0; i < ch.length; i++) {
      const child = ch[i] as Element;
      if (!child || child.nodeType !== 1) continue;
      const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
      if (tag !== "g") continue;

      const rawId = child.getAttribute("id");
      const id = rawId || `layer-${++syntheticIdx}`;
      // Skip duplicate ids (shouldn't happen in valid SVG, but guard)
      if (seenIds.has(id)) {
        enumerateGroups(child, depth + 1);
        continue;
      }
      seenIds.add(id);

      const name =
        child.getAttributeNS(INKSCAPE_NS, "label") ||
        child.getAttribute("inkscape:label") ||
        child.getAttribute("data-name") ||
        id;
      const shapes = collectShapeElements(child, svgRoot);
      const texts = extractAllTextLabels(child, svgRoot);
      const markers = countPointLikeDescendants(child, viewBox.width, viewBox.height);

      layers.push({
        id,
        name,
        shapeCount: shapes.length,
        textCount: texts.length,
        markerCount: markers,
        depth,
      });

      // Recurse into child groups
      enumerateGroups(child, depth + 1);
    }
  };

  enumerateGroups(svgRoot, 0);

  // Add root entry if there are direct shapes/texts on <svg> or no groups at all
  const children = svgRoot.childNodes;
  let rootDirectShapes = 0;
  let rootDirectTexts = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child && child.nodeType === 1) {
      const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
      if (SHAPE_TAGS.has(tag)) rootDirectShapes++;
      if (tag === "text") rootDirectTexts++;
    }
  }
  if (rootDirectShapes > 0 || rootDirectTexts > 0 || layers.length === 0) {
    const rootShapes = collectShapeElements(svgRoot, svgRoot);
    const rootTexts = extractAllTextLabels(svgRoot, svgRoot);
    const rootMarkers = countPointLikeDescendants(svgRoot, viewBox.width, viewBox.height);
    layers.unshift({
      id: "root",
      name: "Root SVG",
      shapeCount: rootShapes.length,
      textCount: rootTexts.length,
      markerCount: rootMarkers,
      depth: 0,
    });
  }

  // 2. Select cities layer (auto-detect if not specified)
  //    Strategy: semantic group name match first, then highest marker count.
  let targetLayerId = opts?.citiesLayerId;
  if (!targetLayerId) {
    // Pass 1: look for a group whose name semantically matches "cities"
    //   Tier A (strong): name contains city/cities/town/towns/settlements — almost
    //   certainly the right layer. Pick the one with the most markers.
    //   Tier B (weak): name IS exactly dots/pins/markers (word boundary match to
    //   avoid "decorative-dots" matching "dots"). Used only if tier A finds nothing.
    const STRONG_PATTERNS = ["cities", "city", "towns", "town", "settlements"];
    const WEAK_PATTERNS = /\b(dots|pins|markers)\b/i;

    let bestStrongId: string | null = null;
    let bestStrongMarkers = 0;
    let bestWeakId: string | null = null;
    let bestWeakMarkers = 0;

    for (const layer of layers) {
      if (layer.markerCount === 0) continue;
      const nameLower = layer.name.toLowerCase();

      if (STRONG_PATTERNS.some((p) => nameLower === p || nameLower.includes(p))) {
        if (layer.markerCount > bestStrongMarkers) {
          bestStrongMarkers = layer.markerCount;
          bestStrongId = layer.id;
        }
      } else if (WEAK_PATTERNS.test(layer.name)) {
        if (layer.markerCount > bestWeakMarkers) {
          bestWeakMarkers = layer.markerCount;
          bestWeakId = layer.id;
        }
      }
    }
    targetLayerId = bestStrongId ?? bestWeakId ?? undefined;

    // Pass 2: fall back to the layer with the most markers
    if (!targetLayerId) {
      let maxMarkers = -1;
      let bestId = layers[0]?.id || "root";
      for (const layer of layers) {
        if (layer.markerCount > maxMarkers) {
          maxMarkers = layer.markerCount;
          bestId = layer.id;
        }
      }
      targetLayerId = bestId;
    }
  }

  const targetGroup = findLayerByIdOrName(svgRoot, targetLayerId) || svgRoot;

  // 3. Extract points from target group
  const rawPoints: { x: number; y: number; el: Element; refIcon?: string; name?: string }[] = [];

  // If the layer has explicit point primitives (circle/ellipse/use dots), those
  // ARE the cities — ignore stray point-like <path>s, which are usually label
  // glyphs (text converted to outlines) sharing the same group.
  const hasPrimitiveMarkers =
    targetGroup.getElementsByTagName("circle").length > 0 ||
    targetGroup.getElementsByTagName("ellipse").length > 0 ||
    targetGroup.getElementsByTagName("use").length > 0;

  const scanGroupForPoints = (el: Element) => {
    const tag = el.localName ?? el.tagName?.split(":").pop() ?? "";

    if (tag === "circle" || tag === "ellipse") {
      const cx = parseFloat(el.getAttribute("cx") || "0");
      const cy = parseFloat(el.getAttribute("cy") || "0");
      const r = parseFloat(el.getAttribute("r") ?? el.getAttribute("rx") ?? "0");
      if (r > 0) {
        const matrix = getAccumulatedTransform(el, svgRoot);
        const [tx, ty] = applyMatrixToPoint(cx, cy, matrix);
        rawPoints.push({ x: tx, y: ty, el });
      }
      return;
    }

    if (tag === "use") {
      const x = parseFloat(el.getAttribute("x") || "0");
      const y = parseFloat(el.getAttribute("y") || "0");
      const href = el.getAttribute("href") || el.getAttribute("xlink:href") || "";
      const matrix = getAccumulatedTransform(el, svgRoot);
      const [tx, ty] = applyMatrixToPoint(x, y, matrix);
      rawPoints.push({ x: tx, y: ty, el, refIcon: href });
      return;
    }

    if (SHAPE_TAGS.has(tag)) {
      if (!hasPrimitiveMarkers && isPointLikeElement(el, viewBox.width, viewBox.height)) {
        try {
          const rings = elementToRings(el);
          if (rings.length > 0 && rings[0]!.length > 0) {
            const matrix = getAccumulatedTransform(el, svgRoot);
            const transformedRings = applyMatrixToRings(rings, matrix);
            let sumX = 0,
              sumY = 0,
              count = 0;
            for (const ring of transformedRings) {
              for (const [px, py] of ring) {
                sumX += px;
                sumY += py;
                count++;
              }
            }
            if (count > 0) {
              rawPoints.push({ x: sumX / count, y: sumY / count, el });
            }
          }
        } catch {}
      }
      return;
    }

    if (tag === "g") {
      const gChildren = el.childNodes;
      for (let i = 0; i < gChildren.length; i++) {
        const child = gChildren[i] as Element;
        if (child && child.nodeType === 1) {
          scanGroupForPoints(child);
        }
      }
    }
  };

  const targetChildren = targetGroup.childNodes;
  for (let i = 0; i < targetChildren.length; i++) {
    const child = targetChildren[i] as Element;
    if (child && child.nodeType === 1) {
      scanGroupForPoints(child);
    }
  }

  // Fallback: if group contains ONLY text elements
  if (rawPoints.length === 0) {
    const textLabels = extractAllTextLabels(targetGroup, svgRoot);
    const shapes = collectShapeElements(targetGroup, svgRoot);
    if (shapes.length === 0 && textLabels.length > 0) {
      for (const label of textLabels) {
        rawPoints.push({
          x: label.x,
          y: label.y,
          el: targetGroup,
          name: label.text,
        });
      }
    }
  }

  // 4. Match names (nearest label)
  let targetNameLayerId = opts?.cityNameLayerId;
  if (!targetNameLayerId) {
    const NAME_STRONG_PATTERNS = ["city names", "city labels", "town names", "names", "labels", "text"];
    let bestNameId: string | null = null;
    let bestNameTextCount = 0;

    for (const layer of layers) {
      if (layer.textCount === 0) continue;
      const nameLower = layer.name.toLowerCase();

      if (NAME_STRONG_PATTERNS.some((p) => nameLower === p || nameLower.includes(p))) {
        if (layer.textCount > bestNameTextCount) {
          bestNameTextCount = layer.textCount;
          bestNameId = layer.id;
        }
      }
    }
    targetNameLayerId = bestNameId ?? undefined;
  }

  const nameLayerContainer = targetNameLayerId ? findLayerByIdOrName(svgRoot, targetNameLayerId) : null;
  let allLabels = nameLayerContainer ? extractAllTextLabels(nameLayerContainer, svgRoot) : [];

  if (allLabels.length === 0) {
    // Try to find any layer whose name contains "city", "label", or "name" and has text
    for (const layer of layers) {
      if (layer.textCount > 0) {
        const nameLower = layer.name.toLowerCase();
        if (nameLower.includes("city") || nameLower.includes("label") || nameLower.includes("name")) {
          const fallbackContainer = findLayerByIdOrName(svgRoot, layer.id);
          if (fallbackContainer) {
            allLabels = extractAllTextLabels(fallbackContainer, svgRoot);
            if (allLabels.length > 0) break;
          }
        }
      }
    }
  }

  // Still empty? Fallback to the entire SVG
  if (allLabels.length === 0) {
    allLabels = extractAllTextLabels(svgRoot, svgRoot);
  }

  const points: SvgCityPoint[] = [];

  for (const pt of rawPoints) {
    if (pt.name !== undefined) {
      points.push({
        svgX: pt.x,
        svgY: pt.y,
        name: pt.name,
        isCapital: false,
      });
      continue;
    }

    let nearestLabel = null;
    let minDistance = Infinity;
    for (const label of allLabels) {
      const d = Math.hypot(pt.x - label.x, pt.y - label.y);
      if (d < minDistance) {
        minDistance = d;
        nearestLabel = label;
      }
    }

    const name = minDistance < 120 && nearestLabel ? nearestLabel.text : "";
    points.push({
      svgX: pt.x,
      svgY: pt.y,
      name,
      isCapital: false,
    });
  }

  // 5. Detect capitals
  const iconCounts = new Map<string, number>();
  let totalIcons = 0;
  for (const pt of rawPoints) {
    if (pt.refIcon) {
      iconCounts.set(pt.refIcon, (iconCounts.get(pt.refIcon) ?? 0) + 1);
      totalIcons++;
    }
  }

  let dominantIcon: string | null = null;
  if (totalIcons > 0) {
    const sortedIcons = Array.from(iconCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedIcons[0] && sortedIcons[0][1] > totalIcons * 0.5) {
      dominantIcon = sortedIcons[0][0];
    }
  }

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    const el = rawPoints[i]!.el;
    const refIcon = rawPoints[i]!.refIcon;

    let isCapital = false;
    if (opts?.capitalLayerId) {
      isCapital = isDescendantOfIdOrName(el, opts.capitalLayerId);
    } else {
      isCapital = hasCapitalAncestor(el);
    }

    if (!isCapital && dominantIcon && refIcon && refIcon !== dominantIcon) {
      isCapital = true;
    }

    pt.isCapital = isCapital;
  }

  // 6. svgProvinces (centroids)
  const svgProvinces: SvgProvinceRef[] = [];
  const provinceLayerResult = detectProvinceLayer(svgRoot);
  const provinceContainer = provinceLayerResult.layer ?? svgRoot;
  const provinceShapes = collectShapeElements(provinceContainer, svgRoot);
  const filteredProvinceShapes = filterProvinceShapes(provinceShapes, svgRoot);

  for (const el of filteredProvinceShapes) {
    try {
      const rings = elementToRings(el);
      if (rings.length > 0 && rings[0]!.length > 0) {
        const matrix = getAccumulatedTransform(el, svgRoot);
        const outerRing = rings[0]!;
        let sumX = 0,
          sumY = 0;
        for (const [x, y] of outerRing) {
          sumX += x;
          sumY += y;
        }
        const localCentroid: [number, number] = [sumX / outerRing.length, sumY / outerRing.length];
        const [rx, ry] = applyMatrixToPoint(localCentroid[0], localCentroid[1], matrix);

        let nearestLabel = null;
        let minDistance = Infinity;
        for (const label of allLabels) {
          const d = Math.hypot(rx - label.x, ry - label.y);
          if (d < minDistance) {
            minDistance = d;
            nearestLabel = label;
          }
        }

        const fallback = detectProvinceName(el, el.getAttribute("id") || "province");
        const name = minDistance < 250 && nearestLabel ? nearestLabel.text : fallback.name;

        svgProvinces.push({
          name,
          svgX: rx,
          svgY: ry,
        });
      }
    } catch {}
  }

  return {
    layers,
    points,
    svgProvinces,
    detectedCitiesLayerId: targetLayerId,
    detectedCityNameLayerId: targetNameLayerId,
  };
}
