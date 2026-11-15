import { withBasePath } from "~/lib/base-path";

/**
 * The refraction behind Facet's Lens layer (`FacetMaterial layer="lens"`, utility `facet-lens`).
 *
 * A displacement map bends the backdrop along each edge (red runs left to right, green top to
 * bottom) while a blurred mid-grey card leaves the middle clear. It is a PNG, decoded once, rather
 * than an SVG the browser rasterises (with its blur) for every lens. The map is stretched to the lens,
 * so the edge band follows its shape. Dispersion: glass bends short wavelengths more, so red, green
 * and blue are displaced by their own scales and added back, and colour fringes grow toward the rim.
 * Scales are fractions of the lens (`primitiveUnits="objectBoundingBox"`), so any size refracts alike.
 */

/** The displacement map, rendered from its SVG source by `scripts/design/render-lens-map.mjs`. */
const LENS_MAP = withBasePath("/images/facet-lens-map.png");

/**
 * Red bends least, blue most; the spread is the dispersion. Negative scales pull the rim inward.
 * Each channel keeps a third of the alpha, so the three add back to the backdrop's own alpha; at full
 * alpha each, a translucent backdrop (inside a masked or filtered ancestor) summed past opaque while
 * its colour stayed a fraction, and the lens went grey. `LENS_RESTORE` scales the colour back up.
 */
const LENS_CHANNELS = [
  { channel: "r", scale: -0.055, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3333 0" },
  { channel: "g", scale: -0.07, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0.3333 0" },
  { channel: "b", scale: -0.09, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0.3334 0" },
] as const;

/** The summed colour is a third of each channel (each came in at a third of the alpha). */
const LENS_RESTORE = "3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0";

/** The one filter every lens points at (`backdrop-filter: url(#facet-lens)` in layers.css). */
export const LENS_FILTER_ID = "facet-lens";

/**
 * The shared SVG filter behind every Lens, rendered once in the root layout. Its units are the lens's
 * own box, so one definition refracts any number of lenses of any size. Chromium applies `url()`
 * filters to backdrops; other engines ignore it and a lens stays a plain frosted pane.
 */
export function LensFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter
        id={LENS_FILTER_ID}
        primitiveUnits="objectBoundingBox"
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={LENS_MAP}
          x="0"
          y="0"
          width="1"
          height="1"
          preserveAspectRatio="none"
          result="map"
        />
        {LENS_CHANNELS.flatMap(({ channel, scale, matrix }) => [
          <feDisplacementMap
            key={`${channel}-bend`}
            in="SourceGraphic"
            in2="map"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
            result={`${channel}-bent`}
          />,
          <feColorMatrix
            key={`${channel}-keep`}
            in={`${channel}-bent`}
            type="matrix"
            values={matrix}
            result={channel}
          />,
        ])}
        <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
        <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="rgb" />
        <feColorMatrix in="rgb" type="matrix" values={LENS_RESTORE} />
      </filter>
    </svg>
  );
}
