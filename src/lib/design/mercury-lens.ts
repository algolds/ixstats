/**
 * The mercury Lens's deformation (the front page hero): where the glass slides and how it
 * squishes for a pointer press, a drag and a hover. Pure numbers; `useMercuryLens` springs them.
 * Every deformation keeps volume (`scaleY = 1 / scaleX`).
 */

export interface LensDeform {
  x: number;
  y: number;
  /** Horizontal scale; the vertical one is its inverse. */
  sx: number;
}

export const REST: LensDeform = { x: 0, y: 0, sx: 1 };

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Apple's rubber band: the further past the start, the less the glass follows. */
export const rubberband = (d: number, dim: number, k = 0.55) =>
  (d * dim * k) / (dim + k * Math.abs(d));

/** A pointer's place in a box, -1 to 1 on that axis. */
export const toUnit = (client: number, start: number, size: number) =>
  clamp(((client - start) / size) * 2 - 1, -1, 1);

/** The press: the glass swells a little toward where it was pressed. */
export function pressDeform(rx: number, ry: number): LensDeform {
  return { x: rx * 6, y: ry * 4, sx: 1.038 };
}

/**
 * The drag from a press at `origin` (pressDeform's x and y): the glass follows 1:1 through a rubber
 * band, stretches along the faster axis, and the press swell fades over the first 48px.
 */
export function dragDeform(
  origin: { x: number; y: number },
  dx: number,
  dy: number,
  vx: number,
  vy: number
): LensDeform {
  const stretch = clamp(
    (Math.abs(dx) - Math.abs(dy)) / 220 + (Math.abs(vx) - Math.abs(vy)) / 5000,
    -0.065,
    0.065
  );
  const pressMix = Math.max(0, 1 - Math.hypot(dx, dy) / 48);
  const sx = clamp(1 + 0.034 * pressMix + stretch, 0.93, 1.08);
  return { x: origin.x + rubberband(dx, 96), y: origin.y + rubberband(dy, 72), sx };
}

/** A resting mouse: the glass leans toward the pointer and widens along the nearer edge. */
export function hoverDeform(rx: number, ry: number): LensDeform {
  return { x: rx * 5, y: ry * 3.5, sx: 1 + (Math.abs(rx) - Math.abs(ry)) * 0.014 };
}
