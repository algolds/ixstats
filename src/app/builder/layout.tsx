"use client";

import { useEffect, useRef, useState } from "react";
import { BackgroundImageTexture } from "~/components/ui/bg-image-texture";

/**
 * Builder Layout - Headless mode with scroll-up navigation reveal
 *
 * The builder starts "headless" - content begins at the top of the viewport.
 * The main site navigation is hidden by default.
 * Wheel up (when content area is at its scroll top) reveals the nav.
 * Wheel down hides it. Touch/mouse drag-up at the top also triggers it.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const [showNav, setShowNav] = useState(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    const isAtTop = () => window.scrollY <= 0;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && isAtTop()) {
        setShowNav(true);
      } else if (e.deltaY > 0) {
        setShowNav(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]!.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop()) return;
      const dy = e.touches[0]!.clientY - touchStartY.current;
      if (dy > 20) {
        setShowNav(true);
      } else if (dy < -20) {
        setShowNav(false);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <>
      {/* CSS to control main navigation visibility */}
      <style {...({ jsx: "true", global: "true" } as any)}>{`
        /* ─── Navigation bar: hidden by default ─── */
        body:has([data-builder-headless]) .navigation-bar {
          transform: translateY(-100%);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          will-change: transform;
        }

        /* ─── Reveal with spring physics overshoot ─── */
        body:has([data-builder-headless][data-show-nav="true"]) .navigation-bar {
          transform: translateY(0);
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          border-bottom-color: rgba(251, 191, 36, 0.25);
        }

        /* ─── Mobile nav siblings ─── */
        body:has([data-builder-headless]) .navigation-bar + div[class*="mobile"],
        body:has([data-builder-headless]) [data-mobile-nav] {
          transform: translateY(-100%);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body:has([data-builder-headless][data-show-nav="true"])
          .navigation-bar
          + div[class*="mobile"],
        body:has([data-builder-headless][data-show-nav="true"]) [data-mobile-nav] {
          transform: translateY(0);
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>

      <div data-builder-headless data-show-nav={showNav} className="relative min-h-screen">
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
