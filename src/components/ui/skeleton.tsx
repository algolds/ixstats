"use client";

import React, { useEffect, useState } from "react";
import { cn } from "~/lib/utils/cn";

function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
  const [blurAmount, setBlurAmount] = useState(4); // Start with rack focus blur

  useEffect(() => {
    // Smoothly decrease blur to 0 after mounting
    const timer = setTimeout(() => {
      setBlurAmount(0);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      style={{
        filter: blurAmount > 0 ? `blur(${blurAmount}px)` : "none",
        transition: "filter 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "filter",
        ...style,
      }}
      {...props}
    />
  );
}

export { Skeleton };
