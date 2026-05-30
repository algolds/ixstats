"use client";

import React from "react";
import { motion } from "motion/react";
import {
  CircleHelp,
  BookOpen,
  Globe,
  Check,
  ExternalLink,
  Download,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Onboarding } from "~/components/ui/onboarding";
import { contextualHelp } from "../data/contextual-help";
import type { BuilderSection } from "../lib/builder-theme";
import { useBuilderFilter } from "./builder-filter-context";

interface BuilderContextualHelpProps {
  activeSection: BuilderSection;
}

export function BuilderContextualHelp({ activeSection }: BuilderContextualHelpProps) {
  const { selectedTemplate } = useBuilderFilter();

  if (activeSection === "foundation") {
    if (selectedTemplate) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-muted/60 h-[42px] gap-2 rounded-xl px-3 text-sm font-medium"
            >
              <CircleHelp className="h-5 w-5" />
              <span className="hidden sm:inline">Help</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Country Archetype Guide
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Overview */}
                <div className="space-y-3">
                  <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                    <Check className="h-4 w-4 text-green-500" />
                    What are Country Archetypes?
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Archetypes are starting economic and political templates based on historical and
                    modern models. Applying an archetype seeds your starting tax structure, public
                    spending values, and key government components, giving you a functional
                    blueprint from day one.
                  </p>
                </div>

                {/* Important Indicators */}
                <div className="space-y-3">
                  <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                    <ExternalLink className="h-4 w-4 text-blue-500" />
                    Key Archetype Concepts
                  </h3>
                  <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                    <li>
                      • <strong>Alignment Profile:</strong> Innovation vs. Stability metrics that
                      place your country on a strategic development vector.
                    </li>
                    <li>
                      • <strong>Traits & Modifiers:</strong> Inherent starting bonuses or penalties
                      (e.g. Technology Hub, High Bureaucracy) that modify gameplay variables.
                    </li>
                    <li>
                      • <strong>Initial Seed:</strong> Pre-populates the Government, Tax, and
                      Spending sliders so you don't have to build from absolute zero.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Archetype Tips */}
              <div className="space-y-4">
                <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                  <CircleHelp className="h-4 w-4 text-amber-500" />
                  Tips for Selection
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800/40 dark:bg-zinc-950/20">
                    <h4 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                      <Check className="h-4 w-4" />
                      Choosing a Blueprint
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Pick an archetype that matches your long-term vision. If you want a highly
                      advanced tech economy, the "Silicon Valley" or "Asian Tiger" models provide
                      excellent starting points.
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800/40 dark:bg-zinc-950/20">
                    <h4 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                      <ExternalLink className="h-4 w-4" />
                      Total Customizability
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Remember, you can fully modify all sliders, tax brackets, and government
                      components in the subsequent steps. The archetype is only a starting
                      suggestion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-muted/60 h-[42px] gap-2 rounded-xl px-3 text-sm font-medium"
          >
            <CircleHelp className="h-5 w-5" />
            <span className="hidden sm:inline">Help</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Foundation Step Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Overview */}
              <div className="space-y-3">
                <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                  <Check className="h-4 w-4 text-green-500" />
                  What is Foundation?
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The Foundation step is where you select a real country as your starting point.
                  This provides baseline economic data, demographics, and cultural context for your
                  nation.
                </p>
              </div>

              {/* Why Foundation Matters */}
              <div className="space-y-3">
                <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  Why Foundation Matters
                </h3>
                <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                  <li>
                    • <strong>Real Data:</strong> Starting with actual economic indicators
                  </li>
                  <li>
                    • <strong>Cultural Context:</strong> Understanding regional characteristics
                  </li>
                  <li>
                    • <strong>Baseline Metrics:</strong> GDP, population, currency, etc.
                  </li>
                  <li>
                    • <strong>Realistic Starting Point:</strong> Build from proven foundations
                  </li>
                </ul>
              </div>
            </div>

            {/* How to Choose */}
            <div className="space-y-4">
              <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                <Download className="h-4 w-4 text-purple-500" />
                How to Choose Your Foundation
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      1
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium">Consider Your Vision</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        What type of nation do you want to build? Choose a foundation that aligns
                        with your goals.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      2
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium">Economic Similarity</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Look for countries with similar economic structures to your desired outcome.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      3
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium">Geographic Context</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Consider regional factors, climate, and natural resources.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      4
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium">Development Level</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Choose a development level that matches your starting vision.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Foundation Data */}
            <div className="space-y-4">
              <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                <ArrowLeft className="h-4 w-4 text-indigo-500" />
                What You Get from Foundation
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Economic Data",
                    items: ["GDP", "Currency", "Trade Balance", "Inflation"],
                  },
                  {
                    title: "Demographics",
                    items: ["Population", "Age Distribution", "Urban/Rural Split"],
                  },
                  {
                    title: "Infrastructure",
                    items: ["Transportation", "Education", "Healthcare Systems"],
                  },
                ].map((section, index) => (
                  <div key={index} className="bg-muted/50 dark:bg-muted/20 rounded-lg p-4">
                    <h4 className="text-foreground mb-2 text-sm font-medium">{section.title}</h4>
                    <ul className="text-muted-foreground space-y-1 text-xs leading-relaxed">
                      {section.items.map((item, itemIndex) => (
                        <li key={itemIndex}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-4">
              <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                <CircleHelp className="h-4 w-4 text-amber-500" />
                Foundation Tips
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800/40 dark:bg-green-950/20">
                  <h4 className="flex items-center gap-2 font-medium text-green-800 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    Good Choices
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-green-700 dark:text-green-300">
                    <li>• Countries with stable economies</li>
                    <li>• Nations with clear cultural identity</li>
                    <li>• Regions with good data availability</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                  <h4 className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-400">
                    <ExternalLink className="h-4 w-4" />
                    Considerations
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-amber-700 dark:text-amber-300">
                    <li>• You can modify everything later</li>
                    <li>• Foundation is just a starting point</li>
                    <li>• Focus on your end vision</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const steps = contextualHelp[activeSection] || contextualHelp.foundation;
  const totalSteps = steps.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-muted/60 h-[42px] gap-2 rounded-xl px-3 text-sm font-medium"
        >
          <CircleHelp className="h-5 w-5" />
          <span className="hidden sm:inline">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" />
            {activeSection === "import"
              ? "Import Guide"
              : `${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Guide`}
          </DialogTitle>
        </DialogHeader>

        <Onboarding totalSteps={totalSteps}>
          <div className="space-y-6">
            {steps.map((step, index) => (
              <Onboarding.Step key={step.title} step={index + 1}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <Onboarding.Header title={step.title} description={step.description} />

                  <div className="flex justify-center">
                    <Onboarding.StepIndicator variant="dots" />
                  </div>
                </motion.div>
              </Onboarding.Step>
            ))}

            <Onboarding.Navigation backLabel="Back" nextLabel="Next" completeLabel="Got it" />
          </div>
        </Onboarding>
      </DialogContent>
    </Dialog>
  );
}
