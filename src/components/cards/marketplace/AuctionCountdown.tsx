// src/components/cards/marketplace/AuctionCountdown.tsx
// Live countdown timer component with IxTime synchronization

"use client";

import React, { useState, useEffect, useMemo, memo } from "react";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import type { CountdownState } from "~/types/marketplace";

interface AuctionCountdownProps {
  endTime: number; // IxTime timestamp
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

/**
 * Calculate countdown state from IxTime timestamps
 */
function calculateCountdown(endTime: number): CountdownState {
  const now = IxTime.getCurrentIxTime();
  const diff = endTime - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      urgency: "critical",
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Determine urgency level
  let urgency: CountdownState["urgency"];
  if (totalSeconds <= 60) {
    urgency = "critical"; // <1min
  } else if (totalSeconds <= 300) {
    urgency = "urgent"; // <5min
  } else if (totalSeconds <= 600) {
    urgency = "moderate"; // <10min
  } else {
    urgency = "safe"; // >10min
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isExpired: false,
    urgency,
  };
}

/**
 * AuctionCountdown - Live timer component with color-coded urgency
 *
 * Urgency levels:
 * - Green (safe): >10min remaining
 * - Yellow (moderate): 5-10min remaining
 * - Orange (urgent): 1-5min remaining
 * - Red (critical): <1min remaining (flashing)
 *
 * @example
 * <AuctionCountdown
 *   endTime={ixTimeTimestamp}
 *   onExpire={() => console.log("Auction ended!")}
 * />
 */
export const AuctionCountdown = memo<AuctionCountdownProps>(
  ({ endTime, onExpire, className, showIcon = true, compact = false }) => {
    const [countdown, setCountdown] = useState<CountdownState>(() =>
      calculateCountdown(endTime)
    );

    // Update countdown every second
    useEffect(() => {
      const interval = setInterval(() => {
        const newCountdown = calculateCountdown(endTime);
        setCountdown(newCountdown);

        // Trigger expiration callback
        if (newCountdown.isExpired && countdown.totalSeconds > 0) {
          onExpire?.();
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [endTime, onExpire, countdown.totalSeconds]);

    // Format countdown display
    const formatted = useMemo(() => {
      if (countdown.isExpired) {
        return "ENDED";
      }

      if (compact) {
        // Compact format: "23m 45s" or "2h 15m"
        if (countdown.days > 0) {
          return `${countdown.days}d ${countdown.hours}h`;
        }
        if (countdown.hours > 0) {
          return `${countdown.hours}h ${countdown.minutes}m`;
        }
        if (countdown.minutes > 0) {
          return `${countdown.minutes}m ${countdown.seconds}s`;
        }
        return `${countdown.seconds}s`;
      }

      // Full format: "1d 2h 30m 45s"
      const parts: string[] = [];
      if (countdown.days > 0) parts.push(`${countdown.days}d`);
      if (countdown.hours > 0 || countdown.days > 0)
        parts.push(`${countdown.hours}h`);
      if (countdown.minutes > 0 || countdown.hours > 0 || countdown.days > 0)
        parts.push(`${countdown.minutes}m`);
      parts.push(`${countdown.seconds}s`);

      return parts.join(" ");
    }, [countdown, compact]);

    // Urgency-based styling
    const urgencyColors = useMemo(() => {
      switch (countdown.urgency) {
        case "safe":
          return {
            text: "text-green-400",
            bg: "bg-green-500/10",
            border: "border-green-500/20",
            icon: "text-green-400",
          };
        case "moderate":
          return {
            text: "text-yellow-400",
            bg: "bg-yellow-500/10",
            border: "border-yellow-500/20",
            icon: "text-yellow-400",
          };
        case "urgent":
          return {
            text: "text-orange-400",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20",
            icon: "text-orange-400",
          };
        case "critical":
          return {
            text: "text-red-400",
            bg: "bg-red-500/10",
            border: "border-red-500/20",
            icon: "text-red-400",
          };
      }
    }, [countdown.urgency]);

    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-medium transition-all",
          urgencyColors.bg,
          urgencyColors.border,
          urgencyColors.text,
          countdown.urgency === "critical" &&
            !countdown.isExpired &&
            "animate-pulse",
          countdown.isExpired && "opacity-50",
          className
        )}
      >
        {showIcon && !countdown.isExpired && (
          <svg
            className={cn("h-4 w-4", urgencyColors.icon)}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}

        <span className="tabular-nums">{formatted}</span>

        {countdown.isExpired && (
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
      </div>
    );
  }
);

AuctionCountdown.displayName = "AuctionCountdown";

/**
 * Hook for getting countdown state (useful for custom UI)
 */
export function useCountdown(endTime: number): CountdownState {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    calculateCountdown(endTime)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(calculateCountdown(endTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return countdown;
}
