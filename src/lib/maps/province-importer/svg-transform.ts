/**
 * SVG Transform Parser & Applicator
 *
 * Parses SVG `transform` attribute strings and accumulates transforms
 * up the DOM tree so coordinates can be converted to a consistent space.
 *
 * SVG matrix convention:
 *   | a c e |   x' = a*x + c*y + e
 *   | b d f |   y' = b*x + d*y + f
 *   | 0 0 1 |
 */

import type { XmlElement } from "./svg-dom";

interface SvgMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY_SVG_MATRIX: SvgMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Multiply two SVG matrices: result = A * B */
function multiplyMatrices(A: SvgMatrix, B: SvgMatrix): SvgMatrix {
  return {
    a: A.a * B.a + A.c * B.b,
    b: A.b * B.a + A.d * B.b,
    c: A.a * B.c + A.c * B.d,
    d: A.b * B.c + A.d * B.d,
    e: A.a * B.e + A.c * B.f + A.e,
    f: A.b * B.e + A.d * B.f + A.f,
  };
}

function isIdentity(m: SvgMatrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

const translateMatrix = (tx: number, ty: number): SvgMatrix => ({
  ...IDENTITY_SVG_MATRIX,
  e: tx,
  f: ty,
});

const rotateMatrix = (radians: number): SvgMatrix => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
};

const toRadians = (degrees = 0) => degrees * (Math.PI / 180);

/** Matrix for each transform function, given its numeric arguments. */
const TRANSFORM_FUNCTIONS: Record<string, (args: number[]) => SvgMatrix> = {
  translate: ([tx = 0, ty = 0]) => translateMatrix(tx, ty),
  scale: ([sx = 1, sy = sx]) => ({ ...IDENTITY_SVG_MATRIX, a: sx, d: sy }),
  rotate: ([angle, cx = 0, cy = 0]) => {
    const rotation = rotateMatrix(toRadians(angle));
    // rotate(angle, cx, cy) = translate(cx,cy) * rotate(angle) * translate(-cx,-cy)
    return cx !== 0 || cy !== 0
      ? multiplyMatrices(
          translateMatrix(cx, cy),
          multiplyMatrices(rotation, translateMatrix(-cx, -cy))
        )
      : rotation;
  },
  matrix: ([a = 1, b = 0, c = 0, d = 1, e = 0, f = 0]) => ({ a, b, c, d, e, f }),
  skewx: ([angle]) => ({ ...IDENTITY_SVG_MATRIX, c: Math.tan(toRadians(angle)) }),
  skewy: ([angle]) => ({ ...IDENTITY_SVG_MATRIX, b: Math.tan(toRadians(angle)) }),
};

/**
 * Parse an SVG `transform` attribute string into a single matrix.
 * Handles: translate, scale, rotate, matrix, skewX, skewY, and chains like
 * "translate(10,20) scale(2)" (composed left to right: result = current * next).
 */
function parseTransformAttr(str: string): SvgMatrix {
  let result: SvgMatrix = { ...IDENTITY_SVG_MATRIX };
  for (const [, fn, rawArgs] of str.matchAll(
    /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/gi
  )) {
    const args = rawArgs!
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(isFinite);
    result = multiplyMatrices(result, TRANSFORM_FUNCTIONS[fn!.toLowerCase()]!(args));
  }
  return result;
}

/**
 * Walk from `el` up to `stopAt` (exclusive) collecting and composing all
 * `transform` attributes. The result transforms coordinates from `el`'s
 * local space to `stopAt`'s coordinate space.
 *
 * Also handles `viewBox` on inner `<svg>` elements.
 */
export function getAccumulatedTransform(el: XmlElement, stopAt: XmlElement): SvgMatrix {
  let result: SvgMatrix = { ...IDENTITY_SVG_MATRIX };

  for (
    let current: XmlElement | null = el;
    current && current !== stopAt;
    current = current.parentNode as XmlElement | null
  ) {
    // Compose: parent transform applied after child → result = parent * child
    const transformAttr = current.getAttribute("transform");
    if (transformAttr) result = multiplyMatrices(parseTransformAttr(transformAttr), result);

    const vbTransform = current.localName === "svg" ? viewBoxTransform(current) : null;
    if (vbTransform) result = multiplyMatrices(vbTransform, result);
  }

  return result;
}

/**
 * Compute the implicit transform from a <svg> element's viewBox to its
 * width/height (a simple scale + translate; preserveAspectRatio is ignored).
 */
function viewBoxTransform(svgEl: XmlElement): SvgMatrix | null {
  const parts = svgEl
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  if (!parts || parts.length < 4) return null;

  const [vbX, vbY, vbW, vbH] = parts as [number, number, number, number];
  const w = parseFloat(svgEl.getAttribute("width") || "0");
  const h = parseFloat(svgEl.getAttribute("height") || "0");
  if (vbW <= 0 || vbH <= 0 || w <= 0 || h <= 0) return null;

  const sx = w / vbW;
  const sy = h / vbH;
  return { a: sx, b: 0, c: 0, d: sy, e: -vbX * sx, f: -vbY * sy };
}

/** Apply an SVG matrix to a single point. */
export function applyMatrixToPoint(x: number, y: number, m: SvgMatrix): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

/** Apply an SVG matrix to all coordinates in a set of rings. */
export function applyMatrixToRings(
  rings: [number, number][][],
  m: SvgMatrix
): [number, number][][] {
  return isIdentity(m)
    ? rings
    : rings.map((ring) => ring.map(([x, y]) => applyMatrixToPoint(x, y, m)));
}
