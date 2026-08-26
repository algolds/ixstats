"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type HeroSection = "Overview" | "Agenda" | "Diplomacy" | "Defense";

export function useHeroAutoCycle(isPremium: boolean) {
  const [activeSection, setActiveSection] = useState<HeroSection>("Overview");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // oxlint-disable-next-line
  const lastInteractionRef = useRef(Date.now());

  const resetAutoCycle = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    autoCycleRef.current = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed >= 60_000) {
        setActiveSection((prev) => {
          const sections: HeroSection[] = isPremium
            ? ["Overview", "Agenda", "Diplomacy", "Defense"]
            : ["Overview", "Agenda", "Diplomacy"];
          const idx = sections.indexOf(prev);
          return sections[(idx + 1) % sections.length]!;
        });
      }
    }, 60_000);

    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [isPremium]);

  const handlePillHover = useCallback(
    (label: HeroSection) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setActiveSection(label);
      }, 400);
      resetAutoCycle();
    },
    [resetAutoCycle]
  );

  const handlePillLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  const handlePillClick = useCallback(
    (label: HeroSection) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setActiveSection(label);
      resetAutoCycle();
    },
    [resetAutoCycle]
  );

  return {
    activeSection,
    setActiveSection,
    handlePillHover,
    handlePillLeave,
    handlePillClick,
  };
}
