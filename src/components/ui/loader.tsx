"use client";

import React from "react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils/cn";

// IOSActivityIndicator: Premium theme-compliant iOS-inspired loading spinner
export function IOSActivityIndicator({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeMap = {
    sm: { container: "h-6 w-6", spokeWidth: "w-[1.5px]", spokeHeight: "h-[5px]", offset: -6 },
    md: { container: "h-9 w-9", spokeWidth: "w-[2.5px]", spokeHeight: "h-[8px]", offset: -9 },
    lg: { container: "h-14 w-14", spokeWidth: "w-[3.5px]", spokeHeight: "h-[12px]", offset: -14 },
  };

  const { container, spokeWidth, spokeHeight, offset } = sizeMap[size];

  return (
    <div className={cn("relative flex items-center justify-center", container, className)}>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute rounded-full bg-neutral-600 dark:bg-neutral-300",
            spokeWidth,
            spokeHeight
          )}
          style={{
            transform: `rotate(${i * 30}deg) translateY(${offset}px)`,
            transformOrigin: "center center",
          }}
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "linear",
            delay: (i / 12) * 0.8,
          }}
        />
      ))}
    </div>
  );
}

// GlobalLoader: Standardized theme-compliant iOS inspired loading screen
export const GlobalLoader = ({
  message = "Loading...",
  className,
}: {
  message?: string;
  className?: string;
}) => {
  const pathname = usePathname();

  // Exclude specialized builder and maps routes
  const isExcluded =
    pathname?.startsWith("/builder") ||
    pathname?.startsWith("/maps") ||
    pathname?.includes("/projects/ixstates/maps");

  if (isExcluded) {
    return null;
  }

  return (
    <div
      className={cn("flex min-h-[50vh] w-full flex-col items-center justify-center p-4", className)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-white/20 bg-white/40 p-6 shadow-xl backdrop-blur-md dark:border-neutral-800/30 dark:bg-neutral-900/40"
      >
        <IOSActivityIndicator size="md" />
        <span className="text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-300">
          {message}
        </span>
      </motion.div>
    </div>
  );
};
