"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  OpenNewWindow as ExternalLink,
  ShieldCheck,
  Download,
  ArrowRight,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";

export interface ImportNationStepProps {
  nationName: string;
  setNationName: (name: string) => void;
  showNameInput: boolean;
  setShowNameInput: (show: boolean) => void;
  onRequestVerification: (nationName: string) => void;
  isPending: boolean;
}

export function ImportNationStep({
  nationName,
  setNationName,
  showNameInput,
  setShowNameInput,
  onRequestVerification,
  isPending,
}: ImportNationStepProps) {
  return (
    <div className="space-y-6">
      {/* Hero visual / Header */}
      <div className="flex flex-col items-center py-4 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <h2 className="text-label text-large-title select-none">Trading Cards</h2>
          <div className="relative h-7 w-10 shrink-0 select-none">
            <div className="border-foreground/80 bg-surface shadow-card absolute top-0.5 left-0 h-6.5 w-4 -rotate-12 rounded-[4px] border-2" />
            <div className="border-foreground/80 bg-surface shadow-card absolute top-0 left-3 flex h-6.5 w-4 items-center justify-center rounded-[4px] border-2">
              <div className="bg-surface-secondary h-1.5 w-1.5 rounded-full" />
            </div>
            <div className="border-foreground/80 bg-surface shadow-card absolute top-0.5 left-6 flex h-6.5 w-4 rotate-12 items-center justify-center rounded-[4px] border-2">
              <div className="bg-surface-secondary h-1.5 w-1.5 rounded-full" />
            </div>
          </div>
        </div>
        <p className="text-label-secondary text-body max-w-md">
          Bring your NationStates trading cards into IxCards. Verify nation ownership and import in
          minutes.
        </p>
      </div>

      {/* How it works cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            step: "1",
            title: "Enter Nation",
            desc: "Type your NationStates nation name",
            icon: Globe,
            color: "amber",
          },
          {
            step: "2",
            title: "Visit NS Link",
            desc: "Open a NationStates verification page",
            icon: ExternalLink,
            color: "cyan",
          },
          {
            step: "3",
            title: "Paste Code",
            desc: "Copy the code NS gives you and paste it here",
            icon: ShieldCheck,
            color: "emerald",
          },
          {
            step: "4",
            title: "Import",
            desc: "Your NS trading cards are imported",
            icon: Download,
            color: "indigo",
          },
        ].map((item) => (
          <FacetCard key={item.step} padding="md" className="flex items-start gap-3">
            <div
              className={cn(
                "bg-tint-fill text-tint rounded-control text-footnote flex size-8 shrink-0 items-center justify-center font-semibold tabular-nums"
              )}
            >
              {item.step}
            </div>
            <div>
              <p className="text-label text-headline">{item.title}</p>
              <p className="text-label-secondary text-footnote">{item.desc}</p>
            </div>
          </FacetCard>
        ))}
      </div>

      {/* Safety Disclaimer */}
      <FacetCard className="text-label-secondary rounded-row text-footnote flex items-start gap-2 p-4 select-none">
        <ShieldCheck className="text-blue mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-label font-semibold">Important</p>
          <p className="leading-relaxed">
            Verification uses the official{" "}
            <a
              href="https://www.nationstates.net/page=api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue hover:underline"
            >
              NationStates API
            </a>{" "}
            and only grants read-only access to verify public deck contents. We will never ask for
            your NationStates password or account credentials.
          </p>
          <NationStatesAttribution className="pt-1" />
        </div>
      </FacetCard>

      <AnimatePresence mode="wait">
        {!showNameInput ? (
          <motion.div
            key="start-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springSmooth}
          >
            <Button
              onClick={() => setShowNameInput(true)}
              className="text-headline h-11 w-full"
              size="lg"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="name-input"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={springSmooth}
          >
            <FacetCard className="rounded-row space-y-3 p-5">
              <div className="flex items-center justify-between">
                <label className="text-label text-headline">Your Nation Name</label>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setNationName("");
                    setShowNameInput(false);
                  }}
                  className="text-label-secondary h-auto px-0 underline"
                >
                  Cancel
                </Button>
              </div>
              <div className="relative">
                <Globe className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={nationName}
                  onChange={(e) => setNationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nationName.trim()) {
                      onRequestVerification(nationName);
                    }
                  }}
                  placeholder="e.g. Testlandia"
                  className="bg-fill-4 focus:bg-background text-body h-12 pl-10"
                  autoFocus
                />
              </div>
              <Button
                onClick={() => onRequestVerification(nationName)}
                disabled={!nationName.trim() || isPending}
                size="lg"
                className="w-full"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Start Verification
              </Button>
            </FacetCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
