"use client";

import { BackgroundImageTexture } from "~/components/ui/bg-image-texture";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

/**
 * Builder Layout - Headless mode with scroll-up navigation reveal
 *
 * The builder starts "headless" - content begins at the top of the viewport.
 * Headless state and scroll-reveal is handled globally by Navigation.
 *
 * The builder creates (and, at /mycountry/editor, edits) a MyCountry nation, so it wears the
 * MyCountry gold tint here too (Facet 3 §2.2) — the same components render under
 * /mycountry/builder and /mycountry/editor inside MyCountry's own `data-app` scope.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="mycountry" className="relative min-h-screen">
      <PortalTintSync />
      <BackgroundImageTexture
        variant="groovepaper"
        opacity={0.05}
        className="pointer-events-none absolute inset-0 z-0"
      />
      {children}
    </div>
  );
}
