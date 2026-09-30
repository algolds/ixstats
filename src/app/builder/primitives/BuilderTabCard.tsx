"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "~/lib/utils";
import { type BuilderSection } from "../lib/builder-theme";

export interface TabDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface BuilderTabCardProps {
  tabs: TabDefinition[];
  activeTab: string;
  onTabChange: (id: string) => void;
  sectionTheme: BuilderSection;
  children: React.ReactNode;
  className?: string;
  hideTabList?: boolean;
}

export function BuilderTabCard({
  tabs,
  activeTab,
  onTabChange,
  sectionTheme,
  children,
  className,
  hideTabList = false,
}: BuilderTabCardProps) {
  const themeStyles: Record<
    BuilderSection,
    {
      indicatorBg: string;
      indicatorBorder: string;
      indicatorGlow: string;
      activeText: string;
      activeIcon: string;
    }
  > = {
    foundation: {
      indicatorBg: "bg-amber-500/10",
      indicatorBorder: "border-amber-500/20",
      indicatorGlow: "shadow-[0_0_8px_rgba(245,158,11,0.2)]",
      activeText: "text-amber-400 font-bold",
      activeIcon: "text-amber-400",
    },
    identity: {
      indicatorBg: "bg-teal-500/10",
      indicatorBorder: "border-teal-500/20",
      indicatorGlow: "shadow-[0_0_8px_rgba(20,184,166,0.2)]",
      activeText: "text-teal-400 font-bold",
      activeIcon: "text-teal-400",
    },
    government: {
      indicatorBg: "bg-cyan-500/10",
      indicatorBorder: "border-cyan-500/20",
      indicatorGlow: "shadow-[0_0_8px_rgba(6,182,212,0.2)]",
      activeText: "text-cyan-400 font-bold",
      activeIcon: "text-cyan-400",
    },
    economics: {
      indicatorBg: "bg-green-500/10",
      indicatorBorder: "border-green-500/20",
      indicatorGlow: "shadow-[0_0_8px_rgba(34,197,94,0.2)]",
      activeText: "text-green-400 font-bold",
      activeIcon: "text-green-400",
    },
    preview: {
      indicatorBg: "bg-amber-500/10",
      indicatorBorder: "border-amber-500/20",
      indicatorGlow: "shadow-[0_0_8px_rgba(245,158,11,0.2)]",
      activeText: "text-amber-400 font-bold",
      activeIcon: "text-amber-400",
    },
    import: {
      indicatorBg: "bg-blue-500/10",
      indicatorBorder: "border-blue-500/20",
      indicatorGlow: "shadow-[0_0_8px_rgba(59,130,246,0.2)]",
      activeText: "text-blue-400 font-bold",
      activeIcon: "text-blue-400",
    },
  };

  const currentTheme = themeStyles[sectionTheme] || themeStyles.foundation;
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  const tabWidthPercent = 100 / tabs.length;

  return (
    <div className={cn("space-y-4", className)}>
      {!hideTabList && (
        <div
          role="tablist"
          className="facet-surface facet-refraction bg-card/50 relative flex gap-1 rounded-xl border p-1 shadow-md"
        >
          {/* Sliding indicator behind active tab */}
          {activeIndex !== -1 && (
            <motion.div
              className={cn(
                "absolute inset-y-1 z-0 rounded-lg border",
                currentTheme.indicatorBg,
                currentTheme.indicatorBorder,
                currentTheme.indicatorGlow
              )}
              layout
              layoutId={`builder-tab-indicator-${sectionTheme}`}
              style={{
                width: `calc(${tabWidthPercent}% - 8px)`,
                left: `calc(${(activeIndex / tabs.length) * 100}% + 4px)`,
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200",
                  isActive ? currentTheme.activeText : "text-muted-foreground hover:text-foreground"
                )}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 transition-colors duration-200",
                    isActive ? currentTheme.activeIcon : "text-muted-foreground/60"
                  )}
                />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Content Area */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="pt-2"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
