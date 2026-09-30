/**
 * Target layer (<g>) selection for the SVG → GeoJSON parser, including the
 * fallbacks for single-layer SVGs exported from Inkscape or Illustrator.
 */

import { SVG_NS, inkscapeLabel, type XmlElement } from "./xml";

type GroupWithPaths = { el: XmlElement; pathCount: number };

function normalizeLayerName(value: string): string {
  return value.toLowerCase().replace(/-/g, "");
}

/**
 * Direct <g> children of `parent`.
 */
function childGroups(parent: XmlElement): XmlElement[] {
  const groups = parent.getElementsByTagNameNS(SVG_NS, "g");
  const children: XmlElement[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    if (g.parentNode === parent) children.push(g);
  }
  return children;
}

/**
 * Match top-level groups by ID or label (case-insensitive, dashes ignored).
 * The last matching group wins; every top-level group ID is reported.
 */
function findLayerByName(
  svgRoot: XmlElement,
  targetLayerId: string
): { targetGroup: XmlElement | null; layersFound: string[] } {
  const layersFound: string[] = [];
  const targetNorm = normalizeLayerName(targetLayerId);
  let targetGroup: XmlElement | null = null;

  for (const g of childGroups(svgRoot)) {
    const gId = g.getAttribute("id") || "";
    if (gId) layersFound.push(gId);
    if (
      normalizeLayerName(gId) === targetNorm ||
      normalizeLayerName(inkscapeLabel(g)) === targetNorm
    ) {
      targetGroup = g;
    }
  }
  return { targetGroup, layersFound };
}

function findNestedLayer(
  groupsWithPaths: GroupWithPaths[],
  targetLayerId: string,
  log: string[]
): XmlElement | null {
  const targetNorm = normalizeLayerName(targetLayerId);
  for (const { el: g } of groupsWithPaths) {
    for (const ng of childGroups(g)) {
      const ngId = normalizeLayerName(ng.getAttribute("id") || "");
      const ngLabel = normalizeLayerName(inkscapeLabel(ng));
      if (ngId === targetNorm || ngLabel === targetNorm) {
        log.push(
          `Found nested layer "${ng.getAttribute("id")}" inside group "${g.getAttribute("id")}"`
        );
        return ng;
      }
    }
  }
  return null;
}

/**
 * Strategy 1: top-level <g> elements that contain paths (at any depth).
 */
function fallbackGroup(
  svgRoot: XmlElement,
  targetLayerId: string,
  log: string[]
): XmlElement | null {
  const groupsWithPaths: GroupWithPaths[] = [];
  for (const g of childGroups(svgRoot)) {
    const pathCount = g.getElementsByTagNameNS(SVG_NS, "path").length;
    if (pathCount > 0) groupsWithPaths.push({ el: g, pathCount });
  }

  if (groupsWithPaths.length === 1) {
    // Single top-level group with paths — use it
    const sole = groupsWithPaths[0]!;
    log.push(
      `Layer "${targetLayerId}" not found by name; using sole group "${sole.el.getAttribute("id")}" (${sole.pathCount} paths)`
    );
    return sole.el;
  }
  if (groupsWithPaths.length === 0) return null;

  // Multiple groups — check nested groups for a name match
  const nested = findNestedLayer(groupsWithPaths, targetLayerId, log);
  if (nested) return nested;

  // Still no match — pick the group with the most paths
  const best = groupsWithPaths.sort((a, b) => b.pathCount - a.pathCount)[0]!;
  log.push(
    `Layer "${targetLayerId}" not found by name; using largest group "${best.el.getAttribute("id")}" (${best.pathCount} paths)`
  );
  return best.el;
}

/**
 * Resolve the layer to extract features from. Throws when no layer (and no
 * paths anywhere in the document) can be found.
 */
export function selectTargetLayer(
  svgRoot: XmlElement,
  targetLayerId: string,
  log: string[]
): { targetGroup: XmlElement; layersFound: string[] } {
  const { targetGroup: named, layersFound } = findLayerByName(svgRoot, targetLayerId);
  log.push(`Layers found in SVG: ${layersFound.join(", ")}`);

  let targetGroup = named ?? fallbackGroup(svgRoot, targetLayerId, log);

  // Strategy 2: Any paths anywhere in the document — use SVG root
  if (!targetGroup) {
    const totalPaths = svgRoot.getElementsByTagNameNS(SVG_NS, "path").length;
    if (totalPaths > 0) {
      targetGroup = svgRoot;
      log.push(
        `Layer "${targetLayerId}" not found by name; using SVG root (${totalPaths} total paths)`
      );
    }
  }

  if (!targetGroup) {
    throw new Error(
      `Layer "${targetLayerId}" not found in SVG. Available layers: ${layersFound.join(", ") || "none"}`
    );
  }
  return { targetGroup, layersFound };
}
