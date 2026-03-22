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

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface SvgMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY_SVG_MATRIX: SvgMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

// ──────────────────────────────────────────────
// Matrix Operations
// ──────────────────────────────────────────────

/** Multiply two SVG matrices: result = A * B */
export function multiplyMatrices(A: SvgMatrix, B: SvgMatrix): SvgMatrix {
  return {
    a: A.a * B.a + A.c * B.b,
    b: A.b * B.a + A.d * B.b,
    c: A.a * B.c + A.c * B.d,
    d: A.b * B.c + A.d * B.d,
    e: A.a * B.e + A.c * B.f + A.e,
    f: A.b * B.e + A.d * B.f + A.f,
  };
}

/** Check if a matrix is identity (no transform). */
export function isIdentity(m: SvgMatrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

// ──────────────────────────────────────────────
// Transform Attribute Parsing
// ──────────────────────────────────────────────

/**
 * Parse an SVG `transform` attribute string into a single matrix.
 * Handles: translate, scale, rotate, matrix, skewX, skewY.
 * Handles chained transforms: "translate(10,20) scale(2)".
 */
export function parseTransformAttr(str: string): SvgMatrix {
  if (!str || !str.trim()) return { ...IDENTITY_SVG_MATRIX };

  let result: SvgMatrix = { ...IDENTITY_SVG_MATRIX };

  // Match individual transform functions
  const funcRegex = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(str)) !== null) {
    const fn = match[1]!.toLowerCase();
    const args = match[2]!
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(isFinite);

    let m: SvgMatrix;

    switch (fn) {
      case "translate":
        m = translateMatrix(args[0] ?? 0, args[1] ?? 0);
        break;
      case "scale": {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        m = scaleMatrix(sx, sy);
        break;
      }
      case "rotate": {
        const angle = (args[0] ?? 0) * (Math.PI / 180);
        const cx = args[1] ?? 0;
        const cy = args[2] ?? 0;
        if (cx !== 0 || cy !== 0) {
          // rotate(angle, cx, cy) = translate(cx,cy) * rotate(angle) * translate(-cx,-cy)
          m = multiplyMatrices(
            translateMatrix(cx, cy),
            multiplyMatrices(rotateMatrix(angle), translateMatrix(-cx, -cy))
          );
        } else {
          m = rotateMatrix(angle);
        }
        break;
      }
      case "matrix":
        m = {
          a: args[0] ?? 1,
          b: args[1] ?? 0,
          c: args[2] ?? 0,
          d: args[3] ?? 1,
          e: args[4] ?? 0,
          f: args[5] ?? 0,
        };
        break;
      case "skewx": {
        const angle = (args[0] ?? 0) * (Math.PI / 180);
        m = { a: 1, b: 0, c: Math.tan(angle), d: 1, e: 0, f: 0 };
        break;
      }
      case "skewy": {
        const angle = (args[0] ?? 0) * (Math.PI / 180);
        m = { a: 1, b: Math.tan(angle), c: 0, d: 1, e: 0, f: 0 };
        break;
      }
      default:
        m = { ...IDENTITY_SVG_MATRIX };
    }

    // SVG transforms are applied left-to-right: "translate(...) scale(...)"
    // means translate is applied first, then scale on top → result = scale * translate
    // But in matrix multiplication order: result = last * ... * first
    // SVG spec: the leftmost transform is applied first to the coordinate system,
    // which means we compose as result = current * new_transform
    result = multiplyMatrices(result, m);
  }

  return result;
}

function translateMatrix(tx: number, ty: number): SvgMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

function scaleMatrix(sx: number, sy: number): SvgMatrix {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

function rotateMatrix(radians: number): SvgMatrix {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

// ──────────────────────────────────────────────
// Accumulated Transform
// ──────────────────────────────────────────────

/**
 * Walk from `el` up to `stopAt` (exclusive) collecting and composing all
 * `transform` attributes. The result transforms coordinates from `el`'s
 * local space to `stopAt`'s coordinate space.
 *
 * Also handles `viewBox` on inner `<svg>` elements.
 */
export function getAccumulatedTransform(el: Element, stopAt: Element): SvgMatrix {
  let result: SvgMatrix = { ...IDENTITY_SVG_MATRIX };

  let current: Element | null = el;
  while (current && current !== stopAt) {
    const transformAttr = current.getAttribute("transform");
    if (transformAttr) {
      const local = parseTransformAttr(transformAttr);
      // Compose: parent transform applied after child → result = parent * child
      result = multiplyMatrices(local, result);
    }

    // Handle viewBox on inner <svg> elements
    if (
      current.localName === "svg" &&
      current !== stopAt &&
      current.getAttribute("viewBox")
    ) {
      const vbTransform = viewBoxTransform(current);
      if (vbTransform) {
        result = multiplyMatrices(vbTransform, result);
      }
    }

    current = current.parentNode as Element | null;
  }

  return result;
}

/**
 * Compute the implicit transform from a <svg> element's viewBox to its
 * width/height (preserveAspectRatio is assumed to be default "xMidYMid meet").
 */
function viewBoxTransform(svgEl: Element): SvgMatrix | null {
  const vb = svgEl.getAttribute("viewBox");
  if (!vb) return null;

  const parts = vb.split(/[\s,]+/).map(Number);
  if (parts.length < 4) return null;

  const [vbX, vbY, vbW, vbH] = parts as [number, number, number, number];
  if (vbW <= 0 || vbH <= 0) return null;

  const w = parseFloat(svgEl.getAttribute("width") || "0");
  const h = parseFloat(svgEl.getAttribute("height") || "0");
  if (w <= 0 || h <= 0) return null;

  // Simple scale + translate (ignoring preserveAspectRatio for now)
  const sx = w / vbW;
  const sy = h / vbH;
  return {
    a: sx,
    b: 0,
    c: 0,
    d: sy,
    e: -vbX * sx,
    f: -vbY * sy,
  };
}

// ──────────────────────────────────────────────
// Coordinate Application
// ──────────────────────────────────────────────

/** Apply an SVG matrix to a single point. */
export function applyMatrixToPoint(
  x: number,
  y: number,
  m: SvgMatrix
): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

/** Apply an SVG matrix to all coordinates in a set of rings. */
export function applyMatrixToRings(
  rings: [number, number][][],
  m: SvgMatrix
): [number, number][][] {
  if (isIdentity(m)) return rings;

  return rings.map((ring) =>
    ring.map(([x, y]) => applyMatrixToPoint(x, y, m))
  );
}
