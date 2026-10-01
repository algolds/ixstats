"use client";

import React from "react";
import { OpenBook as BookOpen, InfoCircle } from "iconoir-react";
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
import { Eyebrow } from "~/components/ui/eyebrow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

const SECTION_BADGES: Record<BuilderSection, string> = {
  foundation: "Step 1: Baseline",
  identity: "Step 2: Sovereignty",
  government: "Step 3: Institutions",
  economics: "Step 4: Economy",
  preview: "Step 5: Review",
  import: "Data Pipeline",
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
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md lg:max-w-lg">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Header */}
          <SheetHeader className="border-separator border-b p-5 text-left">
            <div className="flex items-start gap-3">
              <BookOpen aria-hidden="true" className="text-tint mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-title-3">{sectionTitle}</SheetTitle>
                  <Badge variant="outline">{sectionBadge}</Badge>
                </div>
                <SheetDescription className="text-label-secondary text-footnote mt-0.5">
                  Companion reference, roadmap & core mechanics
                </SheetDescription>
              </div>
            </div>

            <TabsList role="tablist" aria-label="Guide sections" className="mt-4 w-full">
              <TabsTrigger role="tab" value="milestones" className="flex-1">
                Milestones
              </TabsTrigger>
              <TabsTrigger role="tab" value="rules" className="flex-1">
                Rules & Mechanics
              </TabsTrigger>
            </TabsList>
          </SheetHeader>

          {/* Scrollable Content Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <TabsContent value="milestones" role="tabpanel" className="space-y-4">
              <div className="flex items-center justify-between">
                <Eyebrow>Section Roadmap</Eyebrow>
                <Badge variant="outline" className="tabular-nums">
                  {milestones.length} Steps
                </Badge>
              </div>

              <ol className="space-y-3">
                {milestones.map((step, index) => (
                  <li key={index}>
                    <div className="bg-surface-secondary rounded-row flex items-start gap-3 p-3">
                      <span
                        aria-hidden="true"
                        className="text-caption text-label-secondary w-5 shrink-0 pt-px tabular-nums"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-label text-headline">{step.title}</h3>
                        <p className="text-footnote text-label-secondary">{step.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </TabsContent>

            <TabsContent value="rules" role="tabpanel" className="space-y-4">
              <div className="flex items-center justify-between">
                <Eyebrow>Core Mechanics & Rules</Eyebrow>
                <Badge variant="outline" className="tabular-nums">
                  {rules.length} Directives
                </Badge>
              </div>

              <ul className="space-y-3">
                {rules.map((rule, idx) => {
                  const Icon = rule.icon;
                  return (
                    <li key={idx}>
                      <div className="bg-surface-secondary rounded-row flex items-start gap-3 p-3">
                        <Icon
                          aria-hidden="true"
                          className="text-label-secondary mt-0.5 h-4 w-4 shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-label text-headline">{rule.title}</h3>
                            {rule.badge && <Badge variant="secondary">{rule.badge}</Badge>}
                          </div>
                          <p className="text-footnote text-label-secondary">{rule.description}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>

            {/* Quick tip */}
            <div role="note" className="bg-tint-fill rounded-row mt-6 flex items-start gap-2 p-3">
              <InfoCircle aria-hidden="true" className="text-tint mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-footnote text-label-secondary">
                <span className="text-label font-semibold">Statecraft Tip:</span> Choices made in
                this section dynamically calculate your starting power balance, CivCap yields, and
                economic vitality rings across IxStates.
              </p>
            </div>
          </div>
        </Tabs>

        {/* Footer info bar */}
        <div className="border-separator text-label-secondary text-footnote flex items-center justify-between border-t px-5 py-3">
          <span className="flex items-center gap-2">
            <InfoCircle aria-hidden="true" className="h-3.5 w-3.5" />
            Changes auto-save in draft
          </span>
          <span>IxStates Studio</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
