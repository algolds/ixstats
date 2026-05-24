"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { BUILDER_SECTION_THEMES, type BuilderSection } from "../lib/builder-theme";
import { Card, CardContent } from "~/components/ui/card";

export interface TabDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface BuilderTabCardProps {
  tabs: TabDefinition[];
  activeTab: string;
  onTabChange: (id: string) => void;
  sectionTheme: BuilderSection;
  children: React.ReactNode;
  className?: string;
}

export function BuilderTabCard({
  tabs,
  activeTab,
  onTabChange,
  sectionTheme,
  children,
  className,
}: BuilderTabCardProps) {
  const theme = BUILDER_SECTION_THEMES[sectionTheme];

  return (
    <Card
      className={cn(
        "bg-card/40 overflow-hidden border-2 backdrop-blur-sm",
        theme.darkBorder,
        theme.border,
        className
      )}
    >
      {/* Horizontal Tab Bar */}
      <div className="border-border/50 bg-muted/20 scrollbar-hide flex w-full items-center gap-1 overflow-x-auto border-b p-2 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon
                size={16}
                className={cn(
                  "transition-colors",
                  isActive ? theme.text : "group-hover:text-foreground"
                )}
              />
              <span>{tab.label}</span>

              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId={`tab-indicator-${sectionTheme}`}
                  className={cn(
                    "absolute inset-x-0 -bottom-2.5 h-0.5 bg-gradient-to-r",
                    theme.gradient
                  )}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <CardContent className="relative p-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 sm:p-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
