"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Download,
  ArrowRight,
  Loader2,
} from "lucide-react";
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
        <div className="mb-2.5 flex items-center justify-center gap-2.5">
          <h2 className="text-foreground text-3xl font-bold tracking-tight select-none sm:text-4xl">
            Trading Cards
          </h2>
          <div className="relative h-7 w-10 shrink-0 select-none">
            <div className="border-foreground/80 dark:border-border dark:bg-card absolute top-0.5 left-0 h-6.5 w-4 -rotate-12 rounded-[4px] border-2 bg-white shadow-sm" />
            <div className="border-foreground/80 dark:border-border dark:bg-card absolute top-0 left-3 flex h-6.5 w-4 items-center justify-center rounded-[4px] border-2 bg-white shadow-sm">
              <div className="dark:bg-foreground h-1.5 w-1.5 rounded-full bg-slate-900" />
            </div>
            <div className="border-foreground/80 dark:border-border dark:bg-card absolute top-0.5 left-6 flex h-6.5 w-4 rotate-12 items-center justify-center rounded-[4px] border-2 bg-white shadow-sm">
              <div className="dark:bg-foreground h-1.5 w-1.5 rounded-full bg-slate-900" />
            </div>
          </div>
        </div>
        <p className="text-muted-foreground max-w-md text-sm">
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
            color: "rose",
          },
          {
            step: "2",
            title: "Visit NS Link",
            desc: "Open a NationStates verification page",
            icon: ExternalLink,
            color: "amber",
          },
          {
            step: "3",
            title: "Paste Code",
            desc: "Copy the code NS gives you and paste it here",
            icon: ShieldCheck,
            color: "green",
          },
          {
            step: "4",
            title: "Import",
            desc: "Your NS trading cards are imported",
            icon: Download,
            color: "purple",
          },
        ].map((item) => (
          <FacetCard
            key={item.step}
            depth={2}
            className="flex items-start gap-3 rounded-xl p-4 shadow-sm"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white shadow-sm",
                item.color === "rose" && "from-rose-500 to-rose-600",
                item.color === "amber" && "from-amber-500 to-amber-600",
                item.color === "green" && "from-green-500 to-green-600",
                item.color === "purple" && "from-purple-500 to-purple-600"
              )}
            >
              {item.step}
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">{item.title}</p>
              <p className="text-muted-foreground text-xs">{item.desc}</p>
            </div>
          </FacetCard>
        ))}
      </div>

      {/* Safety Disclaimer */}
      <FacetCard
        depth={1}
        className="text-muted-foreground flex items-start gap-2.5 rounded-xl p-4 text-xs select-none"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="space-y-0.5">
          <p className="text-foreground font-bold">Important</p>
          <p className="leading-relaxed">
            Verification uses the official{" "}
            <a
              href="https://www.nationstates.net/page=api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
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
            transition={{ duration: 0.2 }}
          >
            <Button
              onClick={() => setShowNameInput(true)}
              className="h-12 w-full bg-gradient-to-r from-rose-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600 active:scale-[0.98]"
              size="lg"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Get Started
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="name-input"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <FacetCard depth={2} className="space-y-3 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <label className="text-foreground text-sm font-semibold">Your Nation Name</label>
                <button
                  onClick={() => {
                    setNationName("");
                    setShowNameInput(false);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
                >
                  Cancel
                </button>
              </div>
              <div className="relative">
                <Globe className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={nationName}
                  onChange={(e) => setNationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nationName.trim()) {
                      onRequestVerification(nationName);
                    }
                  }}
                  placeholder="e.g. Testlandia"
                  className="glass-hierarchy-interactive bg-muted/30 focus:bg-background h-12 pl-10 text-base"
                  autoFocus
                />
              </div>
              <Button
                onClick={() => onRequestVerification(nationName)}
                disabled={!nationName.trim() || isPending}
                className="h-11 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600 active:scale-[0.98]"
                size="lg"
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
