import { CHARGE_PATHS } from "~/lib/heraldry/charge-paths";
import { sanitizeSvgMarkup } from "~/lib/utils/sanitize-html";
import { cn } from "~/lib/utils";

/**
 * A charge drawn small for a library tile: a built-in charge from the renderer's own path, an imported one from
 * its stored SVG. Both paint in `currentColor`'s place where the art allows, so the tile sets the colour.
 */
export function ChargeGlyph({
  chargeId,
  svgData,
  className,
}: {
  chargeId: string;
  svgData?: string | null;
  className?: string;
}) {
  const path = CHARGE_PATHS[chargeId];
  if (path) {
    return (
      <svg viewBox="-50 -50 100 100" aria-hidden className={cn("size-10", className)}>
        <path d={path} fill="currentColor" fillRule="evenodd" />
      </svg>
    );
  }
  if (!svgData) return <span aria-hidden className={cn("size-10", className)} />;
  return (
    <span
      aria-hidden
      className={cn("flex size-10 items-center justify-center [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{
        __html: sanitizeSvgMarkup(svgData)
          .replace(/width="[^"]*"/, 'width="100%"')
          .replace(/height="[^"]*"/, 'height="100%"'),
      }}
    />
  );
}
