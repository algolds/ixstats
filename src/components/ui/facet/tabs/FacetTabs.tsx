"use client";

import * as React from "react";
import { motion, useTransform } from "motion/react";
import { cn } from "~/lib/utils/cn";
import type { FacetTabsProps, FacetTabItem } from "./types";
import { useTabBounds } from "./useTabBounds";
import { useSliderPhysics } from "../hooks/useSliderPhysics";
import {
  sizeClasses,
  toneIconClasses,
  toneIndicatorStyles,
  grabSpringConfig,
  DRAG_ELASTICITY,
  DRAG_DEAD_ZONE,
} from "./constants";
import { SPRING_PRESETS } from "../shared/constants";

/**
 * Mixes two CSS colours (`progress` 0 → `from`, 1 → `to`) with `color-mix`, so any colour format
 * — roles, system colours, data hex/rgb/oklch — blends without parsing.
 */
function mixColors(from: string, to: string, progress: number): string {
  if (from === to) return from;
  const p = Math.min(1, Math.max(0, progress));
  return `color-mix(in srgb, ${from} ${Math.round((1 - p) * 1000) / 10}%, ${to})`;
}

/** `color` at `percent` opacity, via `color-mix` (no hex/rgba parsing). */
function withAlpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

interface FacetTabTriggerProps {
  tab: FacetTabItem;
  isActive: boolean;
  useThemeColor: boolean;
  bounds?: Record<string, { left: number; width: number }>;
  metrics: (typeof sizeClasses)[keyof typeof sizeClasses];
  tone: keyof typeof toneIconClasses;
  handlers: ReturnType<typeof useSliderPhysics>["handlers"];
  handleTabClick: (tabId: string, e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function FacetTabTrigger({
  tab,
  isActive,
  useThemeColor: _useThemeColor,
  bounds: _bounds,
  metrics,
  tone,
  handlers,
  handleTabClick,
  onKeyDown,
}: FacetTabTriggerProps) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      data-tab-id={tab.id}
      data-cuelume-press="page"
      data-cuelume-hover="tick"
      onKeyDown={onKeyDown}
      onClick={(e) => handleTabClick(tab.id, e)}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      className={cn(
        "relative z-20 flex cursor-pointer items-center justify-center whitespace-nowrap outline-none select-none",
        "duration-fast ease-out-facet transition-[color,transform]",
        tab.className ?? "flex-1",
        "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
        metrics.item,
        isActive
          ? cn("font-semibold", tab.activeTextClassName || "text-label")
          : "text-label-secondary hover:text-label"
      )}
      style={{
        touchAction: "pan-y",
      }}
    >
      {Icon && (
        <span
          aria-hidden
          className={cn(
            metrics.icon,
            "duration-fast flex shrink-0 items-center justify-center transition-colors",
            isActive
              ? tab.activeIconClassName || toneIconClasses[tone] || toneIconClasses.accent
              : "text-label-secondary"
          )}
        >
          <Icon className="h-full w-full" />
        </span>
      )}

      <span className="whitespace-nowrap">{tab.label}</span>

      {tab.badge !== undefined && (
        <span
          className={cn(
            "text-caption flex min-w-5 items-center justify-center rounded-full px-1 tabular-nums",
            isActive ? "bg-label text-background" : "bg-fill-3 text-label-secondary"
          )}
        >
          {tab.badge}
        </span>
      )}
    </button>
  );
}

export function FacetTabs({
  tabs,
  activeTab,
  onChange,
  size = "md",
  tone = "accent",
  springPreset = "fluid",
  texture: _texture,
  showTexture: _showTexture,
  className,
  indicatorClassName,
  "aria-label": ariaLabel,
}: FacetTabsProps) {
  const metrics = sizeClasses[size];
  const { bounds, containerRef } = useTabBounds(tabs);
  const activeBounds = bounds[activeTab];
  // oxlint-disable-next-line
  const containerWidth = containerRef.current?.clientWidth ?? 500;

  const indicatorSpringConfig = SPRING_PRESETS[springPreset];

  // oxlint-disable-next-line
  const { springX, springWidth, springGrab, handlers, handleTabClick } = useSliderPhysics({
    bounds,
    activeId: activeTab,
    onChange,
    padding: metrics.padding,
    // oxlint-disable-next-line
    containerWidth,
    indicatorSpringConfig,
    grabSpringConfig,
    dragElasticity: DRAG_ELASTICITY,
    dragDeadZone: DRAG_DEAD_ZONE,
  });

  // Scale compression on both X and Y driven by springGrab progress (from 1 to 0.95 on grab)
  const activeScale = useTransform(springGrab, [0, 1], [1, 0.95]);

  const activeIndicatorTone = toneIndicatorStyles[tone] || toneIndicatorStyles.accent;

  const useThemeColor = React.useMemo(() => tabs.some((t) => !!t.themeColor), [tabs]);

  // ─── Proximity Color Blending Logic ───────────────────────────────────────
  const interpolatedColor = useTransform(springX, (xValue) => {
    const x = xValue as number;
    const ids = tabs.map((t) => t.id);
    const activeIndex = ids.indexOf(activeTab);
    const defaultColor = tabs[activeIndex]?.themeColor || "var(--color-tint)";

    const hasAllBounds = ids.every((id) => bounds[id] !== undefined);
    if (!hasAllBounds || ids.length < 2) {
      return defaultColor;
    }

    const sortedTabs = ids
      .map((id) => ({ id, left: bounds[id]!.left }))
      .sort((a, b) => a.left - b.left);

    let prevTab = sortedTabs[0]!;
    let nextTab = sortedTabs[sortedTabs.length - 1]!;

    for (let i = 0; i < sortedTabs.length - 1; i++) {
      const current = sortedTabs[i]!;
      const next = sortedTabs[i + 1]!;
      if (x >= current.left && x <= next.left) {
        prevTab = current;
        nextTab = next;
        break;
      }
    }

    if (x <= sortedTabs[0]!.left) {
      return tabs.find((t) => t.id === sortedTabs[0]!.id)?.themeColor || defaultColor;
    }
    if (x >= sortedTabs[sortedTabs.length - 1]!.left) {
      return (
        tabs.find((t) => t.id === sortedTabs[sortedTabs.length - 1]!.id)?.themeColor || defaultColor
      );
    }

    const prevColor = tabs.find((t) => t.id === prevTab.id)?.themeColor || defaultColor;
    const nextColor = tabs.find((t) => t.id === nextTab.id)?.themeColor || defaultColor;

    const range = nextTab.left - prevTab.left;
    if (range <= 0) return prevColor;

    const progress = (x - prevTab.left) / range;
    return mixColors(prevColor, nextColor, progress);
  });

  // Roving focus (WAI-ARIA tabs): arrows move between tabs and activate them.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const ids = tabs.map((t) => t.id);
    const current = ids.indexOf(activeTab);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (current + 1) % ids.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next === null) return;
    e.preventDefault();
    const nextId = ids[next]!;
    onChange(nextId);
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-tab-id]");
    Array.from(buttons ?? [])
      .find((b) => b.dataset.tabId === nextId)
      ?.focus();
  };

  const indicatorBgColor = useTransform(interpolatedColor, (c) => withAlpha(c, 12));
  const indicatorBorderColor = useTransform(interpolatedColor, (c) => withAlpha(c, 28));

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "group/tabs bg-fill-3 relative flex items-center overflow-hidden select-none",
        metrics.container,
        className
      )}
    >
      {/* 1. Active Sliding Background Indicator (Z-10) */}
      {activeBounds && (
        <motion.div
          style={{
            x: springX,
            width: springWidth,
            scale: activeScale,
            backgroundColor: useThemeColor ? indicatorBgColor : undefined,
            borderColor: useThemeColor ? indicatorBorderColor : undefined,
          }}
          className={cn(
            "pointer-events-none absolute z-10 overflow-hidden border",
            metrics.indicatorInset,
            metrics.indicator,
            useThemeColor
              ? ""
              : tabs.find((t) => t.id === activeTab)?.activeIndicatorClassName ||
                  activeIndicatorTone,
            indicatorClassName
          )}
        />
      )}

      {/* 2. Tab Triggers (Z-20) */}
      {tabs.map((tab) => (
        <FacetTabTrigger
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          useThemeColor={useThemeColor}
          bounds={bounds}
          metrics={metrics}
          tone={tone}
          handlers={handlers}
          handleTabClick={handleTabClick}
          onKeyDown={handleKeyDown}
        />
      ))}
    </div>
  );
}
