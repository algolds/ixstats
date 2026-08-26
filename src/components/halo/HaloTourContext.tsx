"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type TourStepId = 1 | 2 | 3 | 4 | 5;

export interface TourStepDetails {
  id: TourStepId;
  title: string;
  description: string;
  targetElementSelector: string; // CSS selector of target for positioning
  placement: "bottom" | "top" | "left" | "right";
}

export const TOUR_STEPS: TourStepDetails[] = [
  {
    id: 1,
    title: "Meet the Halo.",
    description:
      "An intelligent control center. It adapts to what you're doing, keeping notifications, actions, and commands just a glance away.",
    targetElementSelector: "#command-palette",
    placement: "bottom",
  },
  {
    id: 2,
    title: "Your cockpit. Personal.",
    description:
      "Get a direct, live status feed of your country. It adapts dynamically depending on which system you are currently viewing—bringing you relevant metrics, policies, and actions in one seamless view.",
    targetElementSelector: "#command-palette",
    placement: "bottom",
  },
  {
    id: 3,
    title: "Live alerts.",
    description:
      "When something happens on the platform, the Halo will pulse with an alert. Without stopping what you're doing, you can tap on it to see what's happening.",
    targetElementSelector: "#command-palette",
    placement: "bottom",
  },
  {
    id: 4,
    title: "Your control center. Unified.",
    description:
      "Keep track of live notifications, quick actions, and executive context in one elegant view. Tap or glance at the Halo to stay ahead of what matters next.",
    targetElementSelector: "#command-palette",
    placement: "bottom",
  },
  {
    id: 5,
    title: "Control your experience.",
    description:
      "Tailor the Halo settings. Configure layout behavior, interface preferences, and notifications to match your style.",
    targetElementSelector: "#command-palette",
    placement: "bottom",
  },
];

interface HaloTourContextType {
  isActive: boolean;
  currentStep: TourStepId;
  completed: boolean;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTourStatus: () => void;
}

const HaloTourContext = createContext<HaloTourContextType | undefined>(undefined);

export function HaloTourProvider({
  children,
  autoStartDelay = 1000,
}: {
  children: React.ReactNode;
  autoStartDelay?: number;
}) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<TourStepId>(1);
  const [completed, setCompleted] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load status from localStorage and handle invitation banner
  useEffect(() => {
    // oxlint-disable-next-line
    setIsMounted(true);
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    const isMainPage = pathname.includes("/dashboard") || pathname.includes("/mycountry");

    if (!isMainPage) return;

    let timer: NodeJS.Timeout | undefined;
    try {
      const hasCompleted = localStorage.getItem("ixstats:halo-tour-completed") === "true";
      setCompleted(hasCompleted);

      // Pop-up friendly invitation banner for brand new users on production dashboard/mycountry pages
      const wasShownThisSession =
        sessionStorage.getItem("ixstats:halo-tour-invitation-shown") === "true";
      if (!hasCompleted && !wasShownThisSession) {
        sessionStorage.setItem("ixstats:halo-tour-invitation-shown", "true");

        timer = setTimeout(() => {
          import("~/hooks/useNotify")
            .then(({ notifyFromStore }) => {
              notifyFromStore({
                title: "New to the Halo?",
                message: "Take a 1-minute guided tour of your intelligent control center.",
                type: "info",
                priority: "high",
                duration: 15000,
                actions: [
                  {
                    label: "Take Tour",
                    onClick: () => {
                      // Start the tour directly on the active page
                      setIsActive(true);
                      setCurrentStep(1);
                    },
                  },
                  {
                    label: "Maybe Later",
                    onClick: () => {},
                  },
                ],
              });
            })
            .catch(console.error);
        }, 3000); // 3s delay for natural page load flow
      }
    } catch (e) {
      console.error("Failed to process tour auto-start/invitation", e);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  // oxlint-disable-next-line
  }, [autoStartDelay]);

  // Broadcast step updates to trigger state transitions in the Halo component
  useEffect(() => {
    if (!isMounted) return;

    // Dispatch custom DOM event
    window.dispatchEvent(
      new CustomEvent("ix:halo-tour-step", {
        detail: { step: currentStep, active: isActive },
      })
    );
  }, [currentStep, isActive, isMounted]);

  const startTour = useCallback(() => {
    setIsActive(true);
    setCurrentStep(1);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === 5) {
        setIsActive(false);
        setCompleted(true);
        try {
          localStorage.setItem("ixstats:halo-tour-completed", "true");
        } catch (e) {
          console.error(e);
        }
        return 5;
      }
      return (prev + 1) as TourStepId;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : 1) as TourStepId);
  }, []);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setCompleted(true);
    try {
      localStorage.setItem("ixstats:halo-tour-completed", "true");
    } catch (e) {
      console.error(e);
    }
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setCompleted(true);
    try {
      localStorage.setItem("ixstats:halo-tour-completed", "true");
    } catch (e) {
      console.error(e);
    }
  }, []);

  const resetTourStatus = useCallback(() => {
    setCompleted(false);
    setIsActive(false);
    try {
      localStorage.removeItem("ixstats:halo-tour-completed");
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Decoupled window event listeners for sandbox/page control
  useEffect(() => {
    const handleStart = () => startTour();
    const handleNext = () => nextStep();
    const handlePrev = () => prevStep();
    const handleSkip = () => skipTour();
    const handleReset = () => resetTourStatus();

    window.addEventListener("ix:tour-start", handleStart);
    window.addEventListener("ix:tour-next", handleNext);
    window.addEventListener("ix:tour-prev", handlePrev);
    window.addEventListener("ix:tour-skip", handleSkip);
    window.addEventListener("ix:tour-reset", handleReset);

    return () => {
      window.removeEventListener("ix:tour-start", handleStart);
      window.removeEventListener("ix:tour-next", handleNext);
      window.removeEventListener("ix:tour-prev", handlePrev);
      window.removeEventListener("ix:tour-skip", handleSkip);
      window.removeEventListener("ix:tour-reset", handleReset);
    };
  }, [startTour, nextStep, prevStep, skipTour, resetTourStatus]);

  return (
    <HaloTourContext.Provider
      value={{
        isActive,
        currentStep,
        completed,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        resetTourStatus,
      }}
    >
      {children}
    </HaloTourContext.Provider>
  );
}

export function useHaloTour() {
  const context = useContext(HaloTourContext);
  if (!context) {
    throw new Error("useHaloTour must be used within a HaloTourProvider");
  }
  return context;
}
