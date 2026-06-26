"use client";

import { BackgroundImageTexture } from "~/components/ui/bg-image-texture";
import { useHeadlessNav } from "~/hooks/useHeadlessNav";

/**
 * Builder Layout - Headless mode with scroll-up navigation reveal
 *
 * The builder starts "headless" - content begins at the top of the viewport.
 * The main site navigation is hidden by default.
 * Wheel up (when content area is at its scroll top) reveals the nav.
 * Wheel down hides it. Touch/mouse drag-up at the top also triggers it.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const { showNav } = useHeadlessNav();

  return (
    <>
      {/* CSS to control main navigation visibility */}
      <style {...({ jsx: "true", global: "true" } as any)}>{`
        /* ─── Navigation bar: hidden by default ─── */
        body:has([data-headless-nav]) .navigation-bar {
          transform: translateY(-100%);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          will-change: transform;
        }

        /* ─── Reveal with spring physics overshoot ─── */
        body:has([data-headless-nav][data-show-nav="true"]) .navigation-bar {
          transform: translateY(0);
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          border-bottom-color: rgba(251, 191, 36, 0.25);
        }

        /* ─── Mobile nav siblings ─── */
        body:has([data-headless-nav]) .navigation-bar + div[class*="mobile"],
        body:has([data-headless-nav]) [data-mobile-nav] {
          transform: translateY(-100%);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body:has([data-headless-nav][data-show-nav="true"])
          .navigation-bar
          + div[class*="mobile"],
        body:has([data-headless-nav][data-show-nav="true"]) [data-mobile-nav] {
          transform: translateY(0);
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>

      <div
        data-builder-headless
        data-headless-nav
        data-show-nav={showNav}
        className="relative min-h-screen"
      >
        <BackgroundImageTexture
          variant="groovepaper"
          opacity={0.08}
          className="pointer-events-none absolute inset-0 z-0"
        />
        {children}
      </div>
    </>
  );
}
