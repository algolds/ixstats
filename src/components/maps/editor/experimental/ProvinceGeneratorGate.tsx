"use client";

/**
 * ProvinceGeneratorGate — URL-flag guard for Plan 015 spike.
 *
 * Reads `?provgen=1` from the current URL.
 * When absent → renders nothing (zero cost in production).
 * When present → renders <ProvinceGeneratorPreview /> full-screen.
 *
 * Mount this component at the bottom of /maps/page.tsx or any editor
 * page during the spike session.  It does NOT modify any production
 * editor component.
 *
 * Usage (in the maps page, inside `<Suspense>`):
 *   import { ProvinceGeneratorGate } from
 *     "~/components/maps/editor/experimental/ProvinceGeneratorGate";
 *   // ... render at the end of the page JSX:
 *   <ProvinceGeneratorGate />
 */

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// Lazy-load the heavy preview so it doesn't bloat the main bundle.
const ProvinceGeneratorPreview = dynamic(
  () =>
    import("./ProvinceGeneratorPreview").then((m) => ({
      default: m.ProvinceGeneratorPreview,
    })),
  { ssr: false }
);

export function ProvinceGeneratorGate() {
  const searchParams = useSearchParams();
  const enabled = searchParams.get("provgen") === "1";

  if (!enabled) return null;

  // Full-screen overlay; portal-like positioning so it covers the page.
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      <ProvinceGeneratorPreview />
    </div>
  );
}
