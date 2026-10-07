/**
 * SVG elliptical arcs (the path `A` command) flattened to points, by the endpoint-to-centre conversion of the
 * SVG specification (implementation notes, F.6.5/F.6.6): out-of-range radii are scaled up, a zero radius is a
 * straight line. Pure.
 */

const angleBetween = (ux: number, uy: number, vx: number, vy: number) => {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return sign * Math.acos(Math.max(-1, Math.min(1, cos)));
};

/**
 * Points along the arc from (x1, y1) to (x2, y2), the start excluded and the end included. `segmentsPerQuarter`
 * points are used for every quarter turn the arc sweeps (at least one).
 */
export function arcToPoints(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
  segmentsPerQuarter = 4
): [number, number][] {
  if (x1 === x2 && y1 === y2) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[x2, y2]];

  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  const theta1 = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angleBetween(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;

  const steps = Math.max(1, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * segmentsPerQuarter));
  const points: [number, number][] = [];
  for (let i = 1; i <= steps; i++) {
    if (i === steps) {
      points.push([x2, y2]);
      break;
    }
    const t = theta1 + (delta * i) / steps;
    points.push([
      cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx,
      sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy,
    ]);
  }
  return points;
}
