"use client";

import { PortalTintSync } from "~/components/providers/PortalTintSync";

/**
 * Builder Layout - Headless mode with scroll-up navigation reveal
 *
 * The builder starts "headless" - content begins at the top of the viewport.
 * Headless state and scroll-reveal is handled globally by Navigation.
 *
 * Founding (`/builder`) creates a MyCountry nation, so it wears the MyCountry gold tint here
 * too; the editor at /mycountry/editor sits inside MyCountry's own `data-app` scope.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="mycountry" className="relative min-h-screen">
      <PortalTintSync />
      {children}
    </div>
  );
}
