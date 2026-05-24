"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Lightbulb, Upload, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { safeSetItemSync, safeGetItemSync } from "~/lib/localStorageMutex";
import { BUILDER_ACCENT } from "../lib/builder-theme";
import { splashGold } from "~/lib/splash/mycountry-gold";
import type { BuilderSection } from "../lib/builder-theme";

interface BuilderOnboardingBannerProps {
  onOpenImport: () => void;
  className?: string;
  activeSection: BuilderSection;
}

const SECTION_TIPS: Record<BuilderSection, { title: string; description: string }[]> = {
  foundation: [
    {
      title: "Start with a Template",
      description: "Select an existing nation as your starting template, or begin from scratch.",
    },
    {
      title: "Name Your Nation",
      description: "Give your nation a unique name that will appear across all sections.",
    },
    {
      title: "Import from Wiki",
      description:
        "Already have a nation on IxWiki or IIWiki? Import your data to get started faster.",
    },
  ],
  identity: [
    {
      title: "Define Your Flag",
      description: "Upload or describe your national flag and coat of arms.",
    },
    {
      title: "Set National Description",
      description: "Write a compelling overview of your nation's history and culture.",
    },
    {
      title: "Choose Government Type",
      description: "Select the form of government that best fits your nation.",
    },
  ],
  government: [
    {
      title: "Structure Your Branches",
      description: "Define the executive, legislative, and judicial branches of your government.",
    },
    {
      title: "Define Powers & Limits",
      description: "Set the scope of governmental authority and constitutional constraints.",
    },
    {
      title: "Set Legal System",
      description: "Choose your legal framework and judicial processes.",
    },
  ],
  economics: [
    {
      title: "Set Economic System",
      description: "Define your nation's economic model — free market, planned, or mixed.",
    },
    {
      title: "Configure Currency & Trade",
      description: "Establish your currency, trade policies, and economic partnerships.",
    },
    {
      title: "Define Budget Priorities",
      description:
        "Allocate government spending across sectors like military, education, and infrastructure.",
    },
  ],
  preview: [
    {
      title: "Review Your Nation",
      description: "Check all sections to ensure your nation is complete and consistent.",
    },
    {
      title: "Make Final Adjustments",
      description: "Go back to any section to refine details before publishing.",
    },
    {
      title: "Create Your Nation",
      description: "Once satisfied, finalize and create your nation on the wiki.",
    },
  ],
  import: [
    {
      title: "Choose Wiki Source",
      description: "Select from IxWiki, IIWiki, or AltHistory Wiki as your data source.",
    },
    {
      title: "Search for Your Nation",
      description: "Use the search bar to find your existing nation page on the wiki.",
    },
    {
      title: "Review & Import Data",
      description: "Preview the parsed data before importing it into your builder.",
    },
  ],
};

export function BuilderOnboardingBanner({
  onOpenImport,
  className,
  activeSection,
}: BuilderOnboardingBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const dismissed = safeGetItemSync(`builder_onboarding_banner_dismissed_${activeSection}`);
    setIsDismissed(dismissed === "true");
  }, [activeSection]);

  const handleDismiss = () => {
    safeSetItemSync(`builder_onboarding_banner_dismissed_${activeSection}`, "true");
    setIsDismissed(true);
  };

  const handleReset = () => {
    safeSetItemSync(`builder_onboarding_banner_dismissed_${activeSection}`, "false");
    setIsDismissed(false);
  };

  const tips = SECTION_TIPS[activeSection] || SECTION_TIPS.foundation;

  if (isDismissed) {
    return (
      <button
        onClick={handleReset}
        className={cn(
          "text-muted-foreground mb-4 flex items-center gap-2 text-xs transition-colors hover:text-amber-500",
          className
        )}
      >
        <Lightbulb className="h-3 w-3" />
        <span>Show getting started tips</span>
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "mb-6 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 dark:from-amber-900/20 dark:via-yellow-900/20 dark:to-amber-900/20",
          className
        )}
      >
        {/* Header - always visible */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 p-2">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold">Getting Started Tips</h3>
              <p className="text-muted-foreground text-xs">
                {activeSection === "import"
                  ? "Import your nation data from a wiki"
                  : `Tips for building your ${activeSection}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeSection !== "import" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenImport}
                className="text-xs text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import from Wiki
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground hover:text-foreground h-7 w-7"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded content - tips */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-amber-500/20 px-4 pt-3 pb-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {tips.map((tip, index) => (
                    <motion.div
                      key={tip.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 dark:bg-amber-900/10"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600">
                          {index + 1}
                        </div>
                        <span className="text-foreground text-xs font-medium">{tip.title}</span>
                      </div>
                      <p className="text-muted-foreground text-xs">{tip.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default BuilderOnboardingBanner;
