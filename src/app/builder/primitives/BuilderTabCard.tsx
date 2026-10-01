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
      indicatorBg: "bg-tint-fill",
      indicatorBorder: "border-tint/20",
      indicatorGlow: "",
      activeText: "text-tint font-bold",
      activeIcon: "text-tint",
    },
    identity: {
      indicatorBg: "bg-teal/10",
      indicatorBorder: "border-teal/20",
      indicatorGlow: "",
      activeText: "text-teal font-bold",
      activeIcon: "text-teal",
    },
    government: {
      indicatorBg: "bg-teal/10",
      indicatorBorder: "border-teal/20",
      indicatorGlow: "",
      activeText: "text-teal font-bold",
      activeIcon: "text-teal",
    },
    economics: {
      indicatorBg: "bg-green/10",
      indicatorBorder: "border-green/20",
      indicatorGlow: "",
      activeText: "text-green font-bold",
      activeIcon: "text-green",
    },
    preview: {
      indicatorBg: "bg-tint-fill",
      indicatorBorder: "border-tint/20",
      indicatorGlow: "",
      activeText: "text-tint font-bold",
      activeIcon: "text-tint",
    },
    import: {
      indicatorBg: "bg-blue/10",
      indicatorBorder: "border-blue/20",
      indicatorGlow: "",
      activeText: "text-blue font-bold",
      activeIcon: "text-blue",
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
          className="bg-surface rounded-row shadow-card relative flex gap-1 border p-1"
        >
          {/* Sliding indicator behind active tab */}
          {activeIndex !== -1 && (
            <motion.div
              className={cn(
                "rounded-control absolute inset-y-1 z-0 border",
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
                  "rounded-control text-caption relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-2 px-3 py-2 font-semibold whitespace-nowrap transition-colors duration-200",
                  isActive ? currentTheme.activeText : "text-label-secondary hover:text-label"
                )}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 transition-colors duration-200",
                    isActive ? currentTheme.activeIcon : "text-label-tertiary"
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
