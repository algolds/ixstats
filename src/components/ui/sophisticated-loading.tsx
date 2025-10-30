"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface SophisticatedLoadingProps {
  variant?: "atomic" | "dashboard" | "intelligence" | "economic" | "minimal";
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
  theme?: "mycountry" | "global" | "eci" | "sdi";
}

const LoadingVariants = {
  atomic: {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  },
  dashboard: {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  },
  intelligence: {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  },
  economic: {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20",
  },
  minimal: {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  },
};

const ThemeColors = {
  mycountry: {
    primary: "#ca8a04",
    secondary: "#f59e0b",
    accent: "#fbbf24",
  },
  global: {
    primary: "#2563eb",
    secondary: "#3b82f6",
    accent: "#60a5fa",
  },
  eci: {
    primary: "#4f46e5",
    secondary: "#6366f1",
    accent: "#818cf8",
  },
  sdi: {
    primary: "#dc2626",
    secondary: "#ef4444",
    accent: "#f87171",
  },
};

export function SophisticatedLoading({
  variant = "dashboard",
  size = "md",
  message,
  className,
  theme = "global",
}: SophisticatedLoadingProps) {
  const sizeClass = LoadingVariants[variant][size];
  const colors = ThemeColors[theme];

  if (variant === "atomic") {
    return (
      <div
        className={cn("flex flex-col items-center justify-center gap-4 p-6", className)}
        role="status"
        aria-label={message || "Loading atomic components"}
      >
        <div className={cn("relative", sizeClass)}>
          {/* Outer orbital ring */}
          <div
            className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent"
            style={{
              borderColor: `transparent ${colors.primary} transparent transparent`,
              animationDuration: "2s",
            }}
          />

          {/* Middle orbital ring */}
          <div
            className="absolute inset-2 animate-spin rounded-full border-2 border-r-transparent"
            style={{
              borderColor: `${colors.secondary} transparent ${colors.secondary} ${colors.secondary}`,
              animationDuration: "1.5s",
              animationDirection: "reverse",
            }}
          />

          {/* Inner core */}
          <div
            className="absolute inset-4 animate-pulse rounded-full"
            style={{ backgroundColor: colors.accent }}
          />

          {/* Center nucleus */}
          <div className="absolute inset-6 animate-pulse rounded-full bg-white dark:bg-black" />
        </div>

        {message && (
          <div className="max-w-xs animate-pulse text-center text-sm font-medium">
            <div className="text-foreground/80">{message}</div>
            <div className="text-muted-foreground mt-1 text-xs">Building atomic structure...</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "intelligence") {
    return (
      <div
        className={cn("flex flex-col items-center justify-center gap-3", className)}
        role="status"
        aria-label={message || "Processing intelligence"}
      >
        <div className={cn("relative", sizeClass)}>
          {/* Brain-like pulsing pattern */}
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-70" />
          <div
            className="absolute inset-1 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 to-blue-400 opacity-80"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-r from-purple-300 to-indigo-300 opacity-90"
            style={{ animationDelay: "1s" }}
          />

          {/* Neural network lines */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-px w-full animate-pulse bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
            <div
              className="absolute h-full w-px animate-pulse bg-gradient-to-b from-transparent via-purple-400 to-transparent"
              style={{ animationDelay: "0.75s" }}
            />
          </div>
        </div>

        {message && (
          <div className="text-muted-foreground animate-pulse text-center text-xs">{message}</div>
        )}
      </div>
    );
  }

  if (variant === "economic") {
    return (
      <div
        className={cn("flex flex-col items-center justify-center gap-3", className)}
        role="status"
        aria-label={message || "Calculating economic data"}
      >
        <div className={cn("relative", sizeClass)}>
          {/* Economic growth chart simulation */}
          <div className="absolute inset-0 flex items-end justify-center gap-1">
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "30%",
                animationDelay: "0s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "60%",
                animationDelay: "0.2s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "45%",
                animationDelay: "0.4s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "80%",
                animationDelay: "0.6s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "70%",
                animationDelay: "0.8s",
                animationDuration: "1.5s",
              }}
            />
          </div>

          {/* GDP trend line */}
          <div className="absolute inset-0 flex items-center">
            <div
              className="h-px w-full animate-pulse bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 opacity-60"
              style={{ animationDuration: "2s" }}
            />
          </div>
        </div>

        {message && <div className="text-muted-foreground text-center text-xs">{message}</div>}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div
        className={cn("inline-flex items-center gap-2", className)}
        role="status"
        aria-label={message || "Loading"}
      >
        <div className={cn("relative", sizeClass)}>
          <div
            className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: `transparent ${colors.primary} transparent transparent` }}
          />
        </div>
        {message && <span className="text-muted-foreground text-sm">{message}</span>}
      </div>
    );
  }

  // Default dashboard variant
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 p-4", className)}
      role="status"
      aria-label={message || "Loading dashboard"}
    >
      <div className={cn("relative", sizeClass)}>
        {/* Glass-style loading with theme colors */}
        <div
          className="glass-hierarchy-interactive absolute inset-0 animate-spin rounded-full border-2 border-t-transparent"
          style={{
            borderColor: `transparent ${colors.primary} transparent transparent`,
            animationDuration: "1s",
          }}
        />

        {/* Inner rotating ring */}
        <div
          className="absolute inset-2 animate-spin rounded-full border-2 border-r-transparent"
          style={{
            borderColor: `${colors.secondary} transparent ${colors.secondary} ${colors.secondary}`,
            animationDuration: "1.5s",
            animationDirection: "reverse",
          }}
        />

        {/* Center pulse */}
        <div
          className="absolute inset-4 animate-pulse rounded-full"
          style={{ backgroundColor: `${colors.accent}40` }}
        />
      </div>

      {message && (
        <div className="text-foreground/80 text-center text-sm font-medium">{message}</div>
      )}

      {/* Glass loading bar */}
      <div className="bg-muted h-1 w-48 overflow-hidden rounded-full">
        <div
          className="h-full animate-pulse rounded-full"
          style={{
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
            animation: "loading-bar 2s ease-in-out infinite",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 75%;
            margin-left: 12.5%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// Skeleton loading component for content areas
export function SophisticatedSkeleton({
  variant = "card",
  lines = 3,
  className,
}: {
  variant?: "card" | "list" | "chart" | "metric";
  lines?: number;
  className?: string;
}) {
  if (variant === "card") {
    return (
      <div className={cn("glass-hierarchy-child animate-pulse p-6", className)}>
        <div className="mb-4 flex items-center gap-4">
          <div className="bg-muted h-12 w-12 rounded-full" />
          <div className="flex-1">
            <div className="bg-muted mb-2 h-4 w-1/3 rounded" />
            <div className="bg-muted/70 h-3 w-1/2 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              className="bg-muted h-3 rounded"
              style={{ width: `${Math.random() * 40 + 60}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("glass-hierarchy-child animate-pulse p-6", className)}>
        <div className="bg-muted mb-6 h-4 w-1/4 rounded" />
        <div className="flex h-32 items-end gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="bg-muted flex-1 rounded-t"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "metric") {
    return (
      <div className={cn("glass-hierarchy-interactive animate-pulse p-4", className)}>
        <div className="bg-muted mb-3 h-3 w-1/3 rounded" />
        <div className="bg-muted mb-2 h-8 w-1/2 rounded" />
        <div className="bg-muted/70 h-2 w-1/4 rounded" />
      </div>
    );
  }

  // List variant
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="glass-hierarchy-child flex items-center gap-3 p-3">
          <div className="bg-muted h-8 w-8 rounded-full" />
          <div className="flex-1">
            <div className="bg-muted mb-1 h-3 w-2/3 rounded" />
            <div className="bg-muted/70 h-2 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
