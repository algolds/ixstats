"use client";

import React from "react";
import { motion } from "motion/react";
import { CircleHelp, BookOpen } from "lucide-react";
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

interface BuilderContextualHelpProps {
  activeSection: BuilderSection;
}

export function BuilderContextualHelp({ activeSection }: BuilderContextualHelpProps) {
  const steps = contextualHelp[activeSection] || contextualHelp.foundation;
  const totalSteps = steps.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 gap-1.5 text-xs"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" />
            {activeSection === "import" ? "Import Guide" : `${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Guide`}
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
                  <Onboarding.Header
                    title={step.title}
                    description={step.description}
                  />

                  <div className="flex justify-center">
                    <Onboarding.StepIndicator variant="dots" />
                  </div>
                </motion.div>
              </Onboarding.Step>
            ))}

            <Onboarding.Navigation
              backLabel="Back"
              nextLabel="Next"
              completeLabel="Got it"
            />
          </div>
        </Onboarding>
      </DialogContent>
    </Dialog>
  );
}
