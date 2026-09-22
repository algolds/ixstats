"use client";

import React from "react";
import {
  OpenBook as BookOpen,
  InfoCircle,
  Sparks,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { BuilderSection } from "../lib/builder-theme";
import { contextualHelp } from "../data/contextual-help";
import { GUIDE_RULES } from "../data/guide-rules";
import { useBuilderGuide } from "./builder-guide-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";

interface BuilderGuideSheetProps {
  activeSection?: BuilderSection;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SECTION_TITLES: Record<BuilderSection, string> = {
  foundation: "Getting Started",
  identity: "National Identity",
  government: "Government & Law",
  economics: "Fiscal & Trade Engine",
  preview: "Nation Synthesis",
  import: "External Lore Import",
};

const SECTION_BADGES: Record<BuilderSection, { label: string; color: string; border: string }> = {
  foundation: { label: "Step 1: Baseline", color: "text-blue-400", border: "border-blue-500/30" },
  identity: { label: "Step 2: Sovereignty", color: "text-indigo-400", border: "border-indigo-500/30" },
  government: { label: "Step 3: Institutions", color: "text-amber-400", border: "border-amber-500/30" },
  economics: { label: "Step 4: Economy", color: "text-emerald-400", border: "border-emerald-500/30" },
  preview: { label: "Step 5: Review", color: "text-cyan-400", border: "border-cyan-500/30" },
  import: { label: "Data Pipeline", color: "text-purple-400", border: "border-purple-500/30" },
};

export function BuilderGuideSheet({
  activeSection: propSection,
  open: propOpen,
  onOpenChange: propOnOpenChange,
}: BuilderGuideSheetProps) {
  const guideCtx = useBuilderGuide();

  const isOpen = propOpen !== undefined ? propOpen : guideCtx.guideOpen;
  const setOpen = propOnOpenChange !== undefined ? propOnOpenChange : guideCtx.setGuideOpen;
  const activeSection = propSection ?? guideCtx.activeSection;
  const activeTab = guideCtx.activeTab;
  const setActiveTab = guideCtx.setActiveTab;

  const sectionTitle = SECTION_TITLES[activeSection] || activeSection;
  const sectionBadge = SECTION_BADGES[activeSection] || SECTION_BADGES.foundation;
  const milestones = contextualHelp[activeSection] || contextualHelp.foundation;
  const rules = GUIDE_RULES[activeSection] || GUIDE_RULES.foundation;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) {
          guideCtx.closeGuide();
        } else {
          setOpen(true);
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-white/10 bg-card/95 p-0 backdrop-blur-2xl sm:max-w-md lg:max-w-lg"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border/40 p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-inner">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-base font-bold text-foreground">
                    {sectionTitle}
                  </SheetTitle>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      sectionBadge.border,
                      sectionBadge.color
                    )}
                  >
                    {sectionBadge.label}
                  </span>
                </div>
                <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
                  Companion reference, roadmap & core mechanics
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Segmented Control Tabs (Milestones & Rules) */}
          <div className="mt-4 flex rounded-xl border border-border/40 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("milestones")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98]",
                activeTab === "milestones"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Milestones
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98]",
                activeTab === "rules"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Rules & Mechanics
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* TAB 1: MILESTONES */}
          {activeTab === "milestones" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Section Roadmap
                </span>
                <Badge variant="outline" className="border-border/40 text-[10px] font-mono">
                  {milestones.length} Steps
                </Badge>
              </div>

              <div className="space-y-3">
                {milestones.map((step, index) => (
                  <div
                    key={index}
                    className="group relative rounded-xl border border-border/40 bg-card/40 p-3.5 transition-all duration-150 hover:border-amber-500/30 hover:bg-card/70"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-400">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="text-xs font-bold text-foreground group-hover:text-amber-300 transition-colors">
                          {step.title}
                        </h4>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: RULES & DOMAIN MECHANICS */}
          {activeTab === "rules" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Core Mechanics & Rules
                </span>
                <Badge variant="outline" className="border-border/40 text-[10px] font-mono">
                  {rules.length} Directives
                </Badge>
              </div>

              <div className="space-y-3">
                {rules.map((rule, idx) => {
                  const Icon = rule.icon;
                  return (
                    <div
                      key={idx}
                      className="group relative rounded-xl border border-border/40 bg-card/40 p-3.5 transition-all duration-150 hover:border-border/80 hover:bg-card/70"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                            rule.bg ?? "bg-amber-500/10 border-amber-500/20",
                            rule.color ?? "text-amber-400"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground">
                              {rule.title}
                            </h4>
                            {rule.badge && (
                              <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                {rule.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Tip Footer Box */}
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <div className="flex items-start gap-2.5">
              <Sparks className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-amber-300">Statecraft Tip:</span> Choices made
                in this section dynamically calculate your starting power balance, CivCap yields, and
                economic vitality rings across IxStates.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <InfoCircle className="h-3.5 w-3.5" />
            Changes auto-save in draft
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            IxStates Studio
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
