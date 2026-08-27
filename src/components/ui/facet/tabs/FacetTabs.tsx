"use client";

import * as React from "react";
import { motion, useTransform } from "motion/react";
import { cn } from "~/lib/utils";
import type { FacetTabsProps } from "./types";
import { useTabBounds } from "./useTabBounds";
import { useSliderPhysics } from "../hooks/useSliderPhysics";
import {
  sizeClasses,
  toneIndicatorStyles,
  grabSpringConfig,
  DRAG_ELASTICITY,
  DRAG_DEAD_ZONE,
} from "./constants";
import { SPRING_PRESETS } from "../shared/constants";

function blendColors(c1: string, c2: string, progress: number): string {
  const hex = (h: string) => {
    let clean = h.replace("#", "");
    if (clean.length === 3) {
      clean = clean
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  try {
    const rgb1 = hex(c1);
    const rgb2 = hex(c2);

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * progress);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * progress);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * progress);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return c1;
  }
}

interface FacetTabTriggerProps {
  tab: any;
  isActive: boolean;
  useThemeColor: boolean;
  bounds: any;
  metrics: any;
  tone: string;
  handlers: any;
  handleTabClick: any;
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
}: FacetTabTriggerProps) {
  const Icon = tab.icon;

  return (
    <button
      data-tab-id={tab.id}
      onClick={(e) => handleTabClick(tab.id, e)}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      className={cn(
        "relative z-20 flex cursor-pointer items-center justify-center whitespace-nowrap transition-colors duration-150 outline-none select-none",
        tab.className ?? "flex-1",
        "focus-visible:ring-2 focus-visible:ring-indigo-500/50",
        metrics.item,
        isActive
          ? cn(
              "font-semibold",
              tab.activeTextClassName ||
                (tone === "neutral"
                  ? "text-slate-950 dark:text-white"
                  : tone === "accent"
                    ? "text-foreground"
                    : "text-foreground")
            )
          : "text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100"
      )}
      style={{
        touchAction: "pan-y",
      }}
    >
      {Icon && (
        <div
          className={cn(
            metrics.icon,
            "mr-1.5 flex shrink-0 items-center justify-center transition-colors duration-150",
            isActive
              ? tab.activeIconClassName ||
                  (tone === "neutral"
                    ? "text-slate-950 dark:text-white"
                    : tone === "accent"
                      ? "text-indigo-500 dark:text-indigo-400"
                      : tone === "mycountry"
                        ? "text-amber-500 dark:text-amber-400"
                        : tone === "forum"
                          ? "text-orange-500 dark:text-orange-400"
                          : "text-red-500 dark:text-red-400")
              : "text-slate-400 dark:text-slate-500"
          )}
        >
          <Icon className="h-full w-full" />
        </div>
      )}

      <span
        className={cn(
          "whitespace-nowrap transition-colors duration-150",
          isActive ? tab.activeTextClassName || "text-foreground" : "text-muted-foreground"
        )}
      >
        {tab.label}
      </span>

      {tab.badge !== undefined && (
        <span
          className={cn(
            "ml-1.5 flex scale-95 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] leading-none font-bold",
            isActive
              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
              : "bg-black/10 text-slate-600 dark:bg-white/10 dark:text-slate-400"
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
    const defaultColor = tabs[activeIndex]?.themeColor || "#6366f1";

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
    return blendColors(prevColor, nextColor, progress);
  });

  const getRgba = (colorStr: string, opacity: number) => {
    if (colorStr.startsWith("rgb")) {
      const matches = colorStr.match(/\d+/g);
      if (matches && matches.length >= 3) {
        return `rgba(${matches[0]}, ${matches[1]}, ${matches[2]}, ${opacity})`;
      }
      return colorStr;
    }
    let clean = colorStr.replace("#", "");
    if (clean.length === 3) {
      clean = clean
        .split("")
        .map((c) => c + c)
        .join("");
    }
    try {
      const num = parseInt(clean, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } catch {
      return colorStr;
    }
  };

  const indicatorBgColor = useTransform(interpolatedColor, (c) => getRgba(c, 0.12));
  const indicatorBorderColor = useTransform(interpolatedColor, (c) => getRgba(c, 0.28));

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/tabs relative flex items-center overflow-hidden transition-all duration-200 select-none",
        "border-border/60 bg-secondary/40 dark:bg-muted/30 border",
        "shadow-xs",
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
            "pointer-events-none absolute z-10 overflow-hidden border shadow-xs transition-colors duration-200",
            metrics.indicatorInset,
            metrics.indicator,
            useThemeColor
              ? ""
              : tabs.find((t) => t.id === activeTab)?.activeIndicatorClassName ||
                  cn(
                    activeIndicatorTone.light,
                    activeIndicatorTone.dark
                      .split(" ")
                      .map((c) => `dark:${c}`)
                      .join(" ")
                  ),
            indicatorClassName
          )}
        >
          {/* Subtle light-catching top specular edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/15" />
        </motion.div>
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
        />
      ))}
    </div>
  );
}
