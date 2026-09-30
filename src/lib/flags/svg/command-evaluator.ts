export interface SvgPathCommand {
  code: string;
  command: string;
  x?: number;
  y?: number;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/**
 * Calculates point on cubic bezier curve at parameter t in [0, 1]
 */
export function cubicBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number
): [number, number] {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return [
    mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
    mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3,
  ];
}

/**
 * Calculates point on quadratic bezier curve at parameter t in [0, 1]
 */
export function quadraticBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): [number, number] {
  const mt = 1 - t;
  return [mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, mt * mt * y0 + 2 * mt * t * y1 + t * t * y2];
}

/**
 * Calculate adaptive segment count for a cubic bezier based on curve flatness.
 */
export function adaptiveCubicSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  maxSegments: number
): number {
  const dx = x3 - x0;
  const dy = y3 - y0;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen < 1e-6) return 2;

  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / lineLen;
  const d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / lineLen;
  const maxDev = Math.max(d1, d2);
  const flatness = maxDev / lineLen;

  if (flatness < 0.01) return Math.max(2, Math.round(maxSegments * 0.25));
  if (flatness < 0.05) return Math.max(3, Math.round(maxSegments * 0.5));
  if (flatness < 0.15) return Math.max(4, Math.round(maxSegments * 0.75));
  return maxSegments;
}

/**
 * Calculate adaptive segment count for a quadratic bezier.
 */
export function adaptiveQuadSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  maxSegments: number
): number {
  const dx = x2 - x0;
  const dy = y2 - y0;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen < 1e-6) return 2;

  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / lineLen;
  const flatness = d1 / lineLen;

  if (flatness < 0.01) return Math.max(2, Math.round(maxSegments * 0.25));
  if (flatness < 0.05) return Math.max(3, Math.round(maxSegments * 0.5));
  if (flatness < 0.15) return Math.max(4, Math.round(maxSegments * 0.75));
  return maxSegments;
}

/**
 * Convert parsed SVG path commands into arrays of [x, y] coordinate rings.
 */
export function pathCommandsToRings(
  commands: SvgPathCommand[],
  bezierSegments: number
): [number, number][][] {
  const rings: [number, number][][] = [];
  let currentRing: [number, number][] = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of commands) {
    switch (cmd.code) {
      case "M": {
        if (currentRing.length > 2) {
          rings.push(currentRing);
        }
        currentRing = [];
        curX = cmd.x ?? 0;
        curY = cmd.y ?? 0;
        startX = curX;
        startY = curY;
        currentRing.push([curX, curY]);
        break;
      }
      case "L":
      case "H":
      case "A": {
        curX = cmd.x ?? curX;
        curY = cmd.y ?? curY;
        currentRing.push([curX, curY]);
        break;
      }
      case "V": {
        curY = cmd.y ?? curY;
        currentRing.push([curX, curY]);
        break;
      }
      case "C": {
        const x0 = curX;
        const y0 = curY;
        const x1 = cmd.x1 ?? x0;
        const y1 = cmd.y1 ?? y0;
        const x2 = cmd.x2 ?? x1;
        const y2 = cmd.y2 ?? y1;
        const x3 = cmd.x ?? x2;
        const y3 = cmd.y ?? y2;

        const segs = adaptiveCubicSegments(x0, y0, x1, y1, x2, y2, x3, y3, bezierSegments);
        for (let t = 1; t <= segs; t++) {
          const frac = t / segs;
          const [bx, by] = cubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, frac);
          currentRing.push([bx, by]);
        }
        curX = x3;
        curY = y3;
        break;
      }
      case "Q": {
        const qx0 = curX;
        const qy0 = curY;
        const qx1 = cmd.x1 ?? qx0;
        const qy1 = cmd.y1 ?? qy0;
        const qx2 = cmd.x ?? qx1;
        const qy2 = cmd.y ?? qy1;

        const qSegs = adaptiveQuadSegments(qx0, qy0, qx1, qy1, qx2, qy2, bezierSegments);
        for (let t = 1; t <= qSegs; t++) {
          const frac = t / qSegs;
          const [bx, by] = quadraticBezier(qx0, qy0, qx1, qy1, qx2, qy2, frac);
          currentRing.push([bx, by]);
        }
        curX = qx2;
        curY = qy2;
        break;
      }
      case "S": {
        const sx0 = curX;
        const sy0 = curY;
        const sx1 = cmd.x0 !== undefined ? 2 * curX - cmd.x0 : curX;
        const sy1 = cmd.y0 !== undefined ? 2 * curY - cmd.y0 : curY;
        const sx2 = cmd.x2 ?? sx1;
        const sy2 = cmd.y2 ?? sy1;
        const sx3 = cmd.x ?? sx2;
        const sy3 = cmd.y ?? sy2;

        const sSegs = adaptiveCubicSegments(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3, bezierSegments);
        for (let t = 1; t <= sSegs; t++) {
          const frac = t / sSegs;
          const [bx, by] = cubicBezier(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3, frac);
          currentRing.push([bx, by]);
        }
        curX = sx3;
        curY = sy3;
        break;
      }
      case "Z": {
        if (currentRing.length > 2) {
          currentRing.push([startX, startY]);
          rings.push(currentRing);
        }
        currentRing = [];
        curX = startX;
        curY = startY;
        break;
      }
    }
  }

  if (currentRing.length > 2) {
    rings.push(currentRing);
  }

  return rings;
}
