"use client";

// src/app/labs/onoma/components/nav/PhysicsPullFooter.tsx
// Onoma — Physics-Based Flow-Expandable Footer
// Unified DOM Grid-Fraction Expansion · Apple Fluid Interface Curve · Synchronized Viewport Tracking

import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { springSmooth } from "~/lib/design/motion";

interface PhysicsPullFooterProps {
  children: React.ReactNode;
}

export function PhysicsPullFooter({ children }: PhysicsPullFooterProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isRevealed, setIsRevealed] = useState(false);
  const isRevealedRef = useRef(false);
  isRevealedRef.current = isRevealed;

  useEffect(() => {
    if (shouldReduceMotion) return;

    const handleWheel = (e: WheelEvent) => {
      const scrollPos = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const nearBottom = scrollPos >= docHeight - 80;

      // 1. Downward scroll at/near bottom boundary:
      if (nearBottom && e.deltaY > 5 && !isRevealedRef.current) {
        setIsRevealed(true);
      }
      // 2. Upward scroll while revealed:
      else if (isRevealedRef.current && e.deltaY < -12) {
        setIsRevealed(false);
      }
    };

    // Close footer if user scrolls back up into main workspace
    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollPos < docHeight - 400 && isRevealedRef.current) {
        setIsRevealed(false);
      }
    };

    // Mobile touch handling
    let touchStartY = 0;
    let isTouchingNearBottom = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      const scrollPos = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      isTouchingNearBottom = scrollPos >= docHeight - 80;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchingNearBottom || e.touches.length !== 1) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;

      if (deltaY > 20 && !isRevealedRef.current) {
        setIsRevealed(true);
      } else if (deltaY < -20 && isRevealedRef.current) {
        setIsRevealed(false);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) {
    return <div className="relative mx-auto mt-14 w-full max-w-7xl">{children}</div>;
  }

  return (
    /* Unified DOM Grid-Fraction Expansion: 0fr at rest -> 1fr on reveal */
    <div
      className={cn(
        "relative mx-auto grid w-full max-w-7xl transition-[grid-template-rows,margin-top,opacity] duration-300 will-change-[grid-template-rows,margin-top,opacity]",
        isRevealed
          ? "ease-out-facet pointer-events-auto mt-14 grid-rows-[1fr] opacity-100"
          : "ease-out-facet pointer-events-none mt-0 grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <motion.div
          animate={isRevealed ? { y: 0, opacity: 1 } : { y: 16, opacity: 0 }}
          transition={springSmooth}
          className="will-change-transform"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export default PhysicsPullFooter;
