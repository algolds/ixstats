"use client";

import { useEffect, useState } from "react";

export function RackFocusBlurWrapper({ children }: { children: React.ReactNode }) {
  const [isPending, setIsPending] = useState(false);
  const [blurAmount, setBlurAmount] = useState(0);

  useEffect(() => {
    const handleStart = () => {
      setIsPending(true);
      setBlurAmount(10); // Start with smooth cinematic blur
    };

    const handleEnd = () => {
      setIsPending(false);
      setBlurAmount(0); // Decrease blur to zero
    };

    window.addEventListener("ixstats-nav-start", handleStart);
    window.addEventListener("ixstats-nav-end", handleEnd);

    return () => {
      window.removeEventListener("ixstats-nav-start", handleStart);
      window.removeEventListener("ixstats-nav-end", handleEnd);
    };
  }, []);

  return (
    <div
      style={{
        filter: blurAmount > 0 ? `blur(${blurAmount}px)` : "none",
        transition: isPending
          ? "none" // Instant blur on navigation trigger
          : "filter 0.7s cubic-bezier(0.16, 1, 0.3, 1)", // Smooth rack-focus settle
        willChange: "filter",
      }}
      className="h-full w-full"
    >
      {children}
    </div>
  );
}
