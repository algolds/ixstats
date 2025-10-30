"use client";

import React from "react";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { cn } from "~/lib/utils";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../components/glass/GlassCard";
import { LiquidGlassIndicator } from "../components/ui/LiquidGlassIndicator";
import type { Section } from "../types/builder";

interface SectionNavigatorProps {
  sections: Section[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export function SectionNavigator({
  sections,
  activeSection,
  onSectionChange,
}: SectionNavigatorProps) {
  return (
    <GlassCard depth="elevated" blur="medium">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Settings className="text-muted-foreground h-5 w-5" />
          <h3 className="text-foreground font-semibold">Sections</h3>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <motion.button
                key={section.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-all duration-200 md:p-3",
                  "min-h-[44px] touch-manipulation", // iOS minimum touch target
                  isActive
                    ? "bg-accent/20 border-accent text-accent-foreground shadow-lg"
                    : "border-border hover:bg-accent/10 hover:border-accent text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="mb-2 flex items-center gap-3">
                  <Icon className={cn("h-5 w-5", section.color)} />
                  <span
                    className={cn(
                      "font-medium",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {section.name}
                  </span>
                </div>
                <p
                  className={cn(
                    "mb-2 text-sm",
                    isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                  )}
                >
                  {section.description}
                </p>
                <div className="flex items-center gap-3">
                  <LiquidGlassIndicator
                    percentage={section.completeness}
                    color={section.color}
                    size="sm"
                    className="flex-1"
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}
                  >
                    {section.completeness}%
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
