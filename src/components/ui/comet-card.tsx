"use client";
import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "motion/react";
import { cn } from "~/lib/utils";

/**
 * CometCard component props
 */
export interface CometCardProps {
  /** Rotation depth in degrees (default: 17.5) */
  rotateDepth?: number;
  /** Translation depth in pixels (default: 20) */
  translateDepth?: number;
  /** Additional CSS classes */
  className?: string;
  /** Card content */
  children: React.ReactNode;
  /** Enable holographic mode (multi-layer shimmer) */
  holographic?: boolean;
  /** Holographic intensity (0-1, default: 0.6) */
  holographicIntensity?: number;
  /** Enable glass physics depth (default: true) */
  enableGlassPhysics?: boolean;
  /** Glass depth level for shadow intensity */
  glassDepth?: "parent" | "child" | "interactive" | "modal";
  /** Disable all 3D effects (performance mode) */
  disableEffects?: boolean;
}

/**
 * CometCard - Premium 3D card component with holographic effects
 *
 * Features:
 * - 3D tilt effect with mouse tracking
 * - Holographic glare overlay
 * - Optional multi-layer holographic shimmer
 * - Glass physics integration
 * - Configurable depth and intensity
 *
 * @example
 * ```tsx
 * <CometCard holographic={true} glassDepth="child">
 *   <CardContent />
 * </CometCard>
 * ```
 */
export const CometCard = ({
  rotateDepth = 17.5,
  translateDepth = 20,
  className,
  children,
  holographic = false,
  holographicIntensity = 0.6,
  enableGlassPhysics = true,
  glassDepth = "child",
  disableEffects = false,
}: CometCardProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`-${rotateDepth}deg`, `${rotateDepth}deg`],
  );
  const rotateY = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`${rotateDepth}deg`, `-${rotateDepth}deg`],
  );

  const translateX = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${translateDepth}px`, `${translateDepth}px`],
  );
  const translateY = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`${translateDepth}px`, `-${translateDepth}px`],
  );

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.9) 10%, rgba(255, 255, 255, 0.75) 20%, rgba(255, 255, 255, 0) 80%)`;

  // Holographic rainbow shimmer background
  const holographicBackground = useMotionTemplate`linear-gradient(${glareX}deg, rgba(255, 0, 0, ${holographicIntensity * 0.3}) 0%, rgba(255, 127, 0, ${holographicIntensity * 0.3}) 14%, rgba(255, 255, 0, ${holographicIntensity * 0.3}) 28%, rgba(0, 255, 0, ${holographicIntensity * 0.3}) 42%, rgba(0, 0, 255, ${holographicIntensity * 0.3}) 57%, rgba(75, 0, 130, ${holographicIntensity * 0.3}) 71%, rgba(148, 0, 211, ${holographicIntensity * 0.3}) 85%, rgba(255, 0, 0, ${holographicIntensity * 0.3}) 100%)`;

  // Glass physics shadow configuration
  const glassPhysicsShadows: Record<
    "parent" | "child" | "interactive" | "modal",
    string
  > = {
    parent:
      "rgba(0, 0, 0, 0.05) 0px 520px 146px 0px, rgba(0, 0, 0, 0.08) 0px 333px 133px 0px, rgba(0, 0, 0, 0.3) 0px 83px 83px 0px, rgba(0, 0, 0, 0.35) 0px 21px 46px 0px",
    child:
      "rgba(0, 0, 0, 0.03) 0px 420px 126px 0px, rgba(0, 0, 0, 0.06) 0px 273px 113px 0px, rgba(0, 0, 0, 0.25) 0px 73px 73px 0px, rgba(0, 0, 0, 0.3) 0px 18px 40px 0px",
    interactive:
      "rgba(0, 0, 0, 0.08) 0px 620px 166px 0px, rgba(0, 0, 0, 0.12) 0px 393px 153px 0px, rgba(0, 0, 0, 0.35) 0px 93px 93px 0px, rgba(0, 0, 0, 0.4) 0px 24px 52px 0px",
    modal:
      "rgba(0, 0, 0, 0.12) 0px 720px 186px 0px, rgba(0, 0, 0, 0.16) 0px 453px 173px 0px, rgba(0, 0, 0, 0.4) 0px 103px 103px 0px, rgba(0, 0, 0, 0.45) 0px 27px 58px 0px",
  };

  const shadowStyle = enableGlassPhysics
    ? glassPhysicsShadows[glassDepth]
    : "rgba(0, 0, 0, 0.01) 0px 520px 146px 0px, rgba(0, 0, 0, 0.04) 0px 333px 133px 0px, rgba(0, 0, 0, 0.26) 0px 83px 83px 0px, rgba(0, 0, 0, 0.29) 0px 21px 46px 0px";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Conditionally apply effects
  const effectiveRotateX = disableEffects ? "0deg" : rotateX;
  const effectiveRotateY = disableEffects ? "0deg" : rotateY;
  const effectiveTranslateX = disableEffects ? "0px" : translateX;
  const effectiveTranslateY = disableEffects ? "0px" : translateY;

  return (
    <div className={cn("perspective-distant transform-3d", className)}>
      <motion.div
        ref={ref}
        onMouseMove={disableEffects ? undefined : handleMouseMove}
        onMouseLeave={disableEffects ? undefined : handleMouseLeave}
        style={{
          rotateX: effectiveRotateX,
          rotateY: effectiveRotateY,
          translateX: effectiveTranslateX,
          translateY: effectiveTranslateY,
          boxShadow: shadowStyle,
        }}
        initial={{ scale: 1, z: 0 }}
        whileHover={
          disableEffects
            ? undefined
            : {
                scale: 1.05,
                z: 50,
                transition: { duration: 0.2 },
              }
        }
        className="relative rounded-2xl"
      >
        {children}

        {/* Holographic rainbow shimmer layer (if enabled) */}
        {holographic && !disableEffects && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-40 h-full w-full rounded-[16px] mix-blend-overlay"
            style={{
              background: holographicBackground,
              backgroundSize: "200% 200%",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Standard glare overlay */}
        {!disableEffects && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-[16px] mix-blend-overlay"
            style={{
              background: glareBackground,
              opacity: 0.6,
            }}
            transition={{ duration: 0.2 }}
          />
        )}
      </motion.div>
    </div>
  );
};
