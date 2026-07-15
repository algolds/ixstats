"use client";

import { BackgroundImageTexture } from "~/components/ui/bg-image-texture";

/**
 * Builder Layout - Headless mode with scroll-up navigation reveal
 *
 * The builder starts "headless" - content begins at the top of the viewport.
 * Headless state and scroll-reveal is handled globally by Navigation.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-builder-headless
      className="relative min-h-screen"
    >
      <BackgroundImageTexture
        variant="groovepaper"
        opacity={0.08}
        className="pointer-events-none absolute inset-0 z-0"
      />
      {children}
    </div>
  );
}

