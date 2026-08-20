"use client";

// src/app/labs/onoma/components/nav/PhysicsPullFooter.tsx
// Onoma — Physics-Based Flow-Expandable Footer
// Unified DOM Grid-Fraction Expansion · Apple Fluid Interface Curve · Synchronized Viewport Tracking

import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "~/lib/utils";

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
    return (
      <div className="relative mx-auto mt-14 w-full max-w-[1720px] px-1 sm:px-3 lg:px-5">
        {children}
      </div>
    );
  }

  return (
    /* Unified DOM Grid-Fraction Expansion: 0fr at rest -> 1fr on reveal */
    <div
      className={cn(
        "relative mx-auto w-full max-w-[1720px] px-1 sm:px-3 lg:px-5 grid transition-[grid-template-rows,margin-top,opacity] duration-450 will-change-[grid-template-rows,margin-top,opacity]",
        isRevealed
          ? "grid-rows-[1fr] mt-14 opacity-100 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto"
          : "grid-rows-[0fr] mt-0 opacity-0 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {/* Subtle feathered gradient transition from canvas */}
        <div className="pointer-events-none absolute -top-12 inset-x-0 h-16 bg-gradient-to-b from-transparent via-background/40 to-background/90" />

        <motion.div
          animate={
            isRevealed
              ? { y: 0, scale: 1, filter: "blur(0px)" }
              : { y: 16, scale: 0.985, filter: "blur(4px)" }
          }
          transition={{
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1], // Apple fluid interface curve
          }}
          className="will-change-transform"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export default PhysicsPullFooter;
