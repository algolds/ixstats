"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { withBasePath } from "~/lib/base-path";
import { springGentle, springMomentum, springSmooth } from "~/lib/design/motion";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const MYCOUNTRY_CROWN_URL = `url("${withBasePath("/images/ix-monogram-mycountry.svg")}")`;

const MYCOUNTRY_MONOGRAM_TEXTURE = {
  "--monogram-strength": "4%",
  maskImage: `${MYCOUNTRY_CROWN_URL}, ${MYCOUNTRY_CROWN_URL}`,
  maskPosition: "0 0, 90px 45px",
  maskSize: "180px 90px",
  maskRepeat: "repeat",
} as CSSProperties;

const PATTERN_CELLS = Array.from({ length: 18 }, (_, i) => i);

/**
 * Fluid, two-plane MyCountry monogram field behind the Factbook Lens cards:
 * - Plane 1 (deep): tiled MyCountry crown monogram mask (`depth = 10px` pointer + `0.55x` scroll).
 * - Plane 2 (mid): staggered `MyCountryLogo` emblems (`depth = 20px` pointer + `1.0x` scroll +
 *   scroll-velocity inertial throw on `springMomentum`).
 * As the page scrolls or the pointer moves, both planes glide at different depths and settle with
 * spring inertia so the Facet Lens edges continuously refract live movement. Respects Reduce Motion.
 */
export function NationalBackdrop({ children }: { children: React.ReactNode }) {
  const reduceMotion = useFacetReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);

  // Pointer coordinates normalized to [-1, 1] across the Factbook stage.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, springSmooth);
  const py = useSpring(pointerY, springSmooth);

  // Scroll parallax + velocity impulse with spring inertia.
  const scrollOffset = useMotionValue(0);
  const scrollImpulse = useMotionValue(0);
  const smoothScroll = useSpring(scrollOffset, springGentle);
  const inertialImpulse = useSpring(scrollImpulse, springMomentum);

  useEffect(() => {
    if (reduceMotion || typeof window === "undefined") {
      scrollOffset.set(0);
      scrollImpulse.set(0);
      return;
    }

    let lastY = window.scrollY;
    let lastT = performance.now();
    let decayTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      const now = performance.now();
      const currentY = window.scrollY;
      const dy = currentY - lastY;
      const dt = Math.max(now - lastT, 8);
      lastY = currentY;
      lastT = now;

      const rect = stageRef.current?.getBoundingClientRect();
      const viewH = window.innerHeight || 800;
      const centerDelta = rect ? rect.top + rect.height * 0.5 - viewH * 0.5 : -currentY;
      scrollOffset.set(clamp(-centerDelta * 0.14, -56, 56));

      // Velocity in px/frame-ish units -> inertial throw that decays back to 0 when scrolling stops.
      const velocityThrow = clamp((dy / dt) * 28, -42, 42);
      scrollImpulse.set(velocityThrow);

      if (decayTimer) clearTimeout(decayTimer);
      decayTimer = setTimeout(() => {
        scrollImpulse.set(0);
      }, 90);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (decayTimer) clearTimeout(decayTimer);
    };
  }, [reduceMotion, scrollImpulse, scrollOffset]);

  // Plane 1 (deep crown lattice): subtler parallax.
  const deepX = useTransform(px, (v) => (reduceMotion ? 0 : v * -10));
  const deepY = useTransform([py, smoothScroll, inertialImpulse], ([yVal, sVal, iVal]) =>
    reduceMotion ? 0 : (yVal as number) * -10 + (sVal as number) * 0.55 + (iVal as number) * 0.45
  );

  // Plane 2 (mid MyCountryLogo lattice): stronger parallax + inertial velocity throw + slight tilt.
  const midX = useTransform(px, (v) => (reduceMotion ? 0 : v * -20));
  const midY = useTransform([py, smoothScroll, inertialImpulse], ([yVal, sVal, iVal]) =>
    reduceMotion ? 0 : (yVal as number) * -18 + (sVal as number) + (iVal as number)
  );
  const midRotate = useTransform([px, inertialImpulse], ([xVal, iVal]) =>
    reduceMotion ? -12 : -12 + (xVal as number) * 1.8 + (iVal as number) * 0.06
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const rx = clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1);
    const ry = clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1);
    pointerX.set(rx);
    pointerY.set(ry);
  };

  const handlePointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div
      ref={stageRef}
      data-app="mycountry"
      data-slot="national-backdrop"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative isolate"
    >
      <div
        aria-hidden
        className="rounded-card pointer-events-none absolute inset-0 overflow-hidden select-none print:hidden"
      >
        <motion.div
          data-slot="monogram-plane-deep"
          className="facet-monogram absolute -inset-12"
          style={{ ...MYCOUNTRY_MONOGRAM_TEXTURE, x: deepX, y: deepY }}
        />
        <motion.div
          data-slot="monogram-plane-mid"
          style={{ x: midX, y: midY, rotate: midRotate }}
          className="-inset-8 grid -translate-x-4 -translate-y-3 grid-cols-6 gap-x-12 gap-y-10 opacity-[0.04]"
        >
          {PATTERN_CELLS.map((i) => (
            <span
              key={i}
              className={
                i % 2 === 1
                  ? "inline-flex translate-x-6 items-center justify-center"
                  : "inline-flex items-center justify-center"
              }
            >
              <MyCountryLogo size="sm" variant="icon-only" animated={false} />
            </span>
          ))}
        </motion.div>
      </div>
      <div className="relative flex flex-col gap-4">{children}</div>
    </div>
  );
}
