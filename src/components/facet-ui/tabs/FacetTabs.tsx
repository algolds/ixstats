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
  toneGlowClasses,
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
  springX: any;
  springWidth: any;
  bounds: any;
  metrics: any;
  tone: string;
  handlers: any;
  handleTabClick: any;
  updateSheenFromEvent: any;
}

function FacetTabTrigger({
  tab,
  isActive,
  useThemeColor,
  springX,
  springWidth,
  bounds,
  metrics,
  tone,
  handlers,
  handleTabClick,
  updateSheenFromEvent,
}: FacetTabTriggerProps) {
  const tabColor = useTransform([springX, springWidth], ([x, width]) => {
    if (!tab.themeColor) return "rgba(100, 116, 139, 0.65)";

    const center = (x as number) + (width as number) / 2;
    const tabBound = bounds[tab.id];
    if (!tabBound) return "rgba(100, 116, 139, 0.65)";

    const tabCenter = tabBound.left + tabBound.width / 2;
    const distance = Math.abs(center - tabCenter);
    const maxDistance = tabBound.width * 1.1;
    const progress = Math.max(0, Math.min(1, 1 - distance / maxDistance));

    return blendColors("#64748b", tab.themeColor!, progress);
  });

  const Icon = tab.icon;

  return (
    <button
      data-tab-id={tab.id}
      onClick={(e) => handleTabClick(tab.id, e)}
      onPointerDown={(e) => {
        handlers.onPointerDown(e);
        updateSheenFromEvent(e);
      }}
      onPointerMove={(e) => {
        handlers.onPointerMove(e);
        updateSheenFromEvent(e);
      }}
      onPointerUp={(e) => {
        handlers.onPointerUp(e);
        updateSheenFromEvent(e);
      }}
      onPointerCancel={(e) => {
        handlers.onPointerCancel(e);
        updateSheenFromEvent(e);
      }}
      className={cn(
        "relative z-30 flex flex-1 cursor-pointer items-center justify-center outline-none select-none",
        useThemeColor ? "" : "transition-colors duration-200",
        "focus-visible:ring-2 focus-visible:ring-indigo-500/50",
        metrics.item,
        isActive ? "font-semibold" : ""
      )}
      style={{
        touchAction: "pan-y",
      }}
    >
      {Icon && (
        <motion.div
          style={{
            color: useThemeColor ? tabColor : undefined,
          }}
          className={cn(
            metrics.icon,
            "mr-1.5 flex items-center justify-center",
            useThemeColor ? "" : "transition-colors duration-200",
            !useThemeColor &&
              (isActive
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
                : "text-slate-400 dark:text-slate-500")
          )}
        >
          <Icon className="h-full w-full" />
        </motion.div>
      )}

      <motion.span
        style={{
          color: useThemeColor ? tabColor : undefined,
        }}
        className={cn(
          useThemeColor ? "" : "transition-colors duration-200",
          !useThemeColor &&
            (isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")
        )}
      >
        {tab.label}
      </motion.span>

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
  className,
  indicatorClassName,
}: FacetTabsProps) {
  const metrics = sizeClasses[size];
  const { bounds, containerRef } = useTabBounds(tabs);
  const activeBounds = bounds[activeTab];
  const containerWidth = containerRef.current?.clientWidth ?? 500;

  const indicatorSpringConfig = SPRING_PRESETS[springPreset];

  const { springX, springWidth, springGrab, handlers, handleTabClick } = useSliderPhysics({
    bounds,
    activeId: activeTab,
    onChange,
    padding: metrics.padding,
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

  const glowColor = useTransform(interpolatedColor, (c) => getRgba(c, 0.25));
  const indicatorBgColor = useTransform(interpolatedColor, (c) => getRgba(c, 0.08));
  const indicatorBorderColor = useTransform(interpolatedColor, (c) => getRgba(c, 0.22));

  // Track relative pointer coordinates for the frosted satin sheen highlight
  const [sheenPos, setSheenPos] = React.useState({ x: "50%", y: "50%", active: false });

  const updateSheenFromEvent = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    if (activeBounds) {
      const indicatorLeft = activeBounds.left;
      const indicatorWidth = activeBounds.width;
      const relativeX = ((pointerX - indicatorLeft) / indicatorWidth) * 100;
      const relativeY = (pointerY / rect.height) * 100;

      setSheenPos({
        x: `${Math.max(0, Math.min(100, relativeX)).toFixed(1)}%`,
        y: `${Math.max(0, Math.min(100, relativeY)).toFixed(1)}%`,
        active: true,
      });
    }
  };

  const handlePointerLeave = () => {
    setSheenPos((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={updateSheenFromEvent}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "group/tabs relative flex overflow-hidden transition-all duration-300 select-none",
        "border border-black/[0.08] dark:border-white/10",
        "shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        metrics.container,
        className
      )}
    >
      {/* 1. Underlying background color & raw sheens (Z-0) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-black/[0.02] dark:bg-gradient-to-br dark:from-white/[0.04] dark:to-white/[0.005]">
        {/* Softened edge sheens */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent dark:via-white/6" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/12 to-transparent dark:via-white/6" />
        </div>
      </div>

      {/* 2. Subtle backing glow matching the active tone (Z-0) */}
      <motion.div
        style={{
          x: springX,
          width: springWidth,
          backgroundColor: useThemeColor ? glowColor : undefined,
        }}
        className={cn(
          "pointer-events-none absolute inset-y-1 rounded-[inherit] blur-md",
          useThemeColor
            ? "opacity-35 dark:opacity-30"
            : cn(
                "transition-colors duration-300",
                tabs.find((t) => t.id === activeTab)?.glowClassName || toneGlowClasses[tone]
              )
        )}
      />

      {/* 3. Frosted glass backdrop blur filter layer (Z-10) */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] saturate-[190%] backdrop-blur-[20px]"
        style={{
          WebkitBackdropFilter: "blur(20px) saturate(190%)",
        }}
      />

      {/* 4. Active background indicator (Z-20) */}
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
            "pointer-events-none absolute inset-y-1 z-20 overflow-hidden border shadow-sm backdrop-blur-sm",
            useThemeColor ? "" : "transition-colors duration-300",
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
          {/* Frosted Satin Sheen Overlay (follows pointer relative to indicator bounds) */}
          {sheenPos.active && (
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out"
              style={{
                background: `radial-gradient(circle 130px at var(--sheen-x, 50%) var(--sheen-y, 50%), rgba(255, 255, 255, 0.14) 0%, transparent 100%)`,
                mixBlendMode: "overlay",
                // Combine custom properties for coordinates
                ["--sheen-x" as any]: sheenPos.x,
                ["--sheen-y" as any]: sheenPos.y,
              }}
            />
          )}
        </motion.div>
      )}

      {/* 5. Tab Triggers (Z-30) */}
      {tabs.map((tab) => (
        <FacetTabTrigger
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          useThemeColor={useThemeColor}
          springX={springX}
          springWidth={springWidth}
          bounds={bounds}
          metrics={metrics}
          tone={tone}
          handlers={handlers}
          handleTabClick={handleTabClick}
          updateSheenFromEvent={updateSheenFromEvent}
        />
      ))}
    </div>
  );
}
