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

export function FacetTabs({
  tabs,
  activeTab,
  onChange,
  size = "md",
  tone = "accent",
  springPreset = "fluid",
  className,
}: FacetTabsProps) {
  const metrics = sizeClasses[size];
  const { bounds, containerRef } = useTabBounds(tabs);
  const activeBounds = bounds[activeTab];
  const containerWidth = containerRef.current?.clientWidth ?? 500;

  const indicatorSpringConfig = SPRING_PRESETS[springPreset];

  const {
    springX,
    springWidth,
    springGrab,
    handlers,
    handleTabClick,
  } = useSliderPhysics({
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
        "relative flex select-none overflow-hidden transition-all duration-300 group/tabs",
        "border border-black/[0.08] dark:border-white/10",
        "shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        metrics.container,
        className
      )}
    >
      {/* 1. Underlying background color & raw sheens (Z-0) */}
      <div className="absolute inset-0 bg-black/[0.02] dark:bg-gradient-to-br dark:from-white/[0.04] dark:to-white/[0.005] rounded-[inherit] overflow-hidden pointer-events-none z-0">
        {/* Softened edge sheens */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent dark:via-white/6" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/12 to-transparent dark:via-white/6" />
        </div>
      </div>

      {/* 2. Subtle backing glow matching the active tone (Z-0) */}
      <motion.div
        style={{
          x: springX,
          width: springWidth,
        }}
        className={cn(
          "absolute inset-y-1 rounded-[inherit] blur-md opacity-20 dark:opacity-25 pointer-events-none transition-colors duration-300",
          tabs.find((t) => t.id === activeTab)?.glowClassName || toneGlowClasses[tone]
        )}
      />

      {/* 3. Frosted glass backdrop blur filter layer (Z-10) */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none rounded-[inherit] backdrop-blur-[20px] saturate-[190%]"
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
          }}
          className={cn(
            "absolute inset-y-1 z-20 border shadow-sm backdrop-blur-sm pointer-events-none transition-colors duration-300 overflow-hidden",
            metrics.indicator,
            tabs.find((t) => t.id === activeTab)?.activeIndicatorClassName || cn(
              activeIndicatorTone.light,
              activeIndicatorTone.dark.split(" ").map(c => `dark:${c}`).join(" ")
            )
          )}
        >
          {/* Frosted Satin Sheen Overlay (follows pointer relative to indicator bounds) */}
          {sheenPos.active && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out"
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
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
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
              "relative z-30 flex flex-1 items-center justify-center cursor-pointer transition-colors duration-200 select-none outline-none",
              "focus-visible:ring-2 focus-visible:ring-indigo-500/50",
              metrics.item,
              isActive
                ? cn("font-semibold", tab.activeTextClassName || "text-foreground")
                : "text-muted-foreground hover:text-foreground"
            )}
            style={{
              touchAction: "pan-y",
            }}
          >
            {Icon && (
              <Icon
                className={cn(
                  metrics.icon,
                  "transition-colors duration-200",
                  isActive
                    ? tab.activeIconClassName || (
                        tone === "neutral"
                          ? "text-slate-950 dark:text-white"
                          : tone === "accent"
                            ? "text-indigo-500 dark:text-indigo-400"
                            : tone === "mycountry"
                              ? "text-amber-500 dark:text-amber-400"
                              : tone === "forum"
                                ? "text-orange-500 dark:text-orange-400"
                                : "text-red-500 dark:text-red-400"
                      )
                    : "text-slate-400 dark:text-slate-500"
                )}
              />
            )}
            
            <span>{tab.label}</span>

            {tab.badge !== undefined && (
              <span
                className={cn(
                  "ml-1.5 flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none scale-95",
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
      })}
    </div>
  );
}

