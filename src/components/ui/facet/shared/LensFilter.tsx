/**
 * The refraction behind Facet's Lens layer (`FacetMaterial layer="lens"`, utility `facet-lens`).
 *
 * A displacement map bends the backdrop along each edge (red runs left to right, green top to
 * bottom) while a blurred mid-grey card leaves the middle clear. The map is stretched to the lens,
 * so the edge band follows its shape. Dispersion: glass bends short wavelengths more, so red, green
 * and blue are displaced by their own scales and added back, and colour fringes grow toward the rim.
 * Scales are fractions of the lens (`primitiveUnits="objectBoundingBox"`), so any size refracts alike.
 */

const LENS_MAP = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
    '<defs><linearGradient id="r" x2="1"><stop stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>' +
    '<linearGradient id="g" x2="0" y2="1"><stop stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient>' +
    '<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs>' +
    '<rect width="100" height="100" fill="url(#r)"/>' +
    '<rect width="100" height="100" fill="url(#g)" style="mix-blend-mode:screen"/>' +
    '<rect x="8" y="12" width="84" height="76" rx="18" fill="#808080" filter="url(#b)"/></svg>'
)}`;

/** Red bends least, blue most; the spread is the dispersion. Negative scales pull the rim inward. */
const LENS_CHANNELS = [
  { channel: "r", scale: -0.055, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
  { channel: "g", scale: -0.07, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
  { channel: "b", scale: -0.09, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
] as const;

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
        <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
      </filter>
    </svg>
  );
}
