// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wiki-os/reader/IxTimeTooltip.tsx
// IxTime date display with tooltip showing IxTime equivalent.
// Wraps any date reference in articles with a hover tooltip.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { IxTime } from "~/lib/ixtime";

/**
 * Renders the current IxTime date as a styled badge.
 * Shows both real-world and in-game dates.
 */
export function IxTimeBadge() {
  const [ixTime, setIxTime] = useState<number | null>(null);

  useEffect(() => {
    setIxTime(IxTime.getCurrentIxTime());
    const interval = setInterval(() => {
      setIxTime(IxTime.getCurrentIxTime());
    }, 60_000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (!ixTime) return null;

  const gameYear = IxTime.getCurrentGameYear();
  const formatted = IxTime.formatIxTime(ixTime);

  return (
    <span className="wikios-ixtime-badge" title={`IxTime: ${formatted}`}>
      IxYear {gameYear}
    </span>
  );
}

/**
 * Inline IxTime display that shows the current game date.
 * For embedding in article content or sidebars.
 */
export function IxTimeDisplay({ format = "date" }: { format?: "date" | "year" | "full" }) {
  const [ixTime, setIxTime] = useState<number | null>(null);

  useEffect(() => {
    setIxTime(IxTime.getCurrentIxTime());
  }, []);

  if (!ixTime) return <span className="wikios-ixtime-loading">...</span>;

  switch (format) {
    case "year":
      return <span className="wikios-ixtime-inline">{IxTime.getCurrentGameYear()}</span>;
    case "full":
      return <span className="wikios-ixtime-inline">{IxTime.formatIxTime(ixTime, true)}</span>;
    case "date":
    default:
      return <span className="wikios-ixtime-inline">{IxTime.formatIxTime(ixTime)}</span>;
  }
}

/**
 * Hook that scans article content for date patterns and adds IxTime tooltips.
 * Attaches to a container ref and handles hover events on date-like text.
 */
export function useIxTimeTooltips(containerRef: React.RefObject<HTMLElement | null>) {
  const [tooltip, setTooltip] = useState<{
    realDate: string;
    ixDate: string;
    x: number;
    y: number;
  } | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  const hide = useCallback(() => {
    hideTimeout.current = setTimeout(() => setTooltip(null), 150);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Find elements with data-ixtime attribute (set by article processing)
    const handleMouseEnter = (e: Event) => {
      const target = (e.target as HTMLElement).closest("[data-ixtime]");
      if (!target) return;

      if (hideTimeout.current) clearTimeout(hideTimeout.current);

      const realDate = target.getAttribute("data-ixtime") ?? "";
      try {
        const realTimestamp = new Date(realDate).getTime();
        const ixTimestamp = IxTime.convertToIxTime(realTimestamp);
        const ixFormatted = IxTime.formatIxTime(ixTimestamp);

        const rect = (target as HTMLElement).getBoundingClientRect();
        setTooltip({
          realDate,
          ixDate: ixFormatted,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 6,
        });
      } catch {
        // Invalid date, ignore
      }
    };

    const handleMouseLeave = (e: Event) => {
      const target = (e.target as HTMLElement).closest("[data-ixtime]");
      if (target) hide();
    };

    container.addEventListener("mouseenter", handleMouseEnter, true);
    container.addEventListener("mouseleave", handleMouseLeave, true);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter, true);
      container.removeEventListener("mouseleave", handleMouseLeave, true);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [containerRef, hide]);

  if (!tooltip) return null;

  return createPortal(
    <div
      className="wikios-ixtime-tooltip glass-hierarchy-child"
      style={{
        position: "fixed",
        left: Math.max(8, Math.min(tooltip.x - 100, window.innerWidth - 216)),
        top: Math.min(tooltip.y, window.innerHeight - 60),
        zIndex: 10001,
      }}
      onMouseEnter={() => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
      }}
      onMouseLeave={hide}
    >
      <div className="wikios-ixtime-tooltip-row">
        <span className="wikios-ixtime-tooltip-label">Real:</span>
        <span>{tooltip.realDate}</span>
      </div>
      <div className="wikios-ixtime-tooltip-row">
        <span className="wikios-ixtime-tooltip-label">IxTime:</span>
        <span>{tooltip.ixDate}</span>
      </div>
    </div>,
    document.body
  );
}
