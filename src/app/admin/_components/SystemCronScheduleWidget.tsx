// src/app/admin/_components/SystemCronScheduleWidget.tsx
// Visualizes and diagnoses the system cron jobs / background tasks
"use client";

import React, { useState } from "react";
import { CronSchedule } from "~/components/ui/cron-schedule";
import { cn } from "~/lib/utils";
import { Gavel, Coins, LineChart, Sparkles, RefreshCw, Award, Clock } from "lucide-react";

const CRON_JOBS = [
  {
    id: "auctions",
    title: "Auction Completion",
    description: "Processes expired auctions, determines winners, and handles payouts.",
    expression: "* * * * *",
    icon: Gavel,
    color: "text-amber-500 dark:text-amber-400 border-amber-500/20 bg-amber-500/5",
  },
  {
    id: "passive-income",
    title: "Passive Income Distribution",
    description: "Calculates and deposits passive income for all qualifying nations daily.",
    expression: "0 0 * * *",
    icon: Coins,
    color: "text-emerald-500 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  },
  {
    id: "card-value",
    title: "Card Value Tracking",
    description: "Updates evaluation metrics, market trends, and historic valuations for cards.",
    expression: "0 */6 * * *",
    icon: LineChart,
    color: "text-sky-500 dark:text-sky-400 border-sky-500/20 bg-sky-500/5",
  },
  {
    id: "lore-cards",
    title: "Lore Card Generation",
    description: "Triggers AI-generated narrative events and special lore card drops.",
    expression: "0 2 * * *",
    icon: Sparkles,
    color: "text-purple-500 dark:text-purple-400 border-purple-500/20 bg-purple-500/5",
  },
  {
    id: "twitter-sync",
    title: "IxTwitter Discord Sync",
    description: "Pulls recent social alerts and synchronizes them to ThinkPages.",
    expression: "0 * * * *",
    icon: RefreshCw,
    color: "text-indigo-500 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
  },
  {
    id: "lorewards",
    title: "Lorewards fullSync",
    description: "Performs full synchronization of system rewards, roles, and achievements.",
    expression: "0 6 * * *",
    icon: Award,
    color: "text-rose-500 dark:text-rose-400 border-rose-500/20 bg-rose-500/5",
  },
] as const;

export function SystemCronScheduleWidget() {
  const [selectedId, setSelectedId] = useState<string>("auctions");
  const selectedJob = CRON_JOBS.find((job) => job.id === selectedId) ?? CRON_JOBS[0];

  const IconComponent = selectedJob.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-foreground flex items-center gap-2 text-base font-bold tracking-tight">
          <Clock className="text-primary h-4.5 w-4.5" />
          System Cron Schedules
        </h2>
        <span className="text-muted-foreground bg-primary/5 border-primary/10 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          UTC Reference
        </span>
      </div>

      <div className="glass-surface border-border/40 flex min-h-[380px] flex-1 flex-col gap-4 rounded-xl p-4 shadow-sm md:flex-row">
        {/* Left Side: Cron List */}
        <div className="border-border/20 flex w-full flex-col gap-2 border-b pb-4 md:w-2/5 md:border-r md:border-b-0 md:pr-4 md:pb-0">
          <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
            Registered Tasks
          </p>
          <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1 md:max-h-[340px]">
            {CRON_JOBS.map((job) => {
              const JobIcon = job.icon;
              const isSelected = job.id === selectedId;

              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-2.5 text-left transition-all duration-200",
                    isSelected
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "hover:bg-muted/10 hover:border-border/30 border-transparent bg-transparent"
                  )}
                >
                  <div className={cn("shrink-0 rounded-lg border p-1.5", job.color)}>
                    <JobIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-xs font-semibold",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {job.title}
                      </span>
                    </div>
                    <code className="text-muted-foreground mt-0.5 block font-mono text-[10px]">
                      {job.expression}
                    </code>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Visualizer */}
        <div className="flex w-full flex-col justify-between md:w-3/5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={cn("hidden shrink-0 rounded-lg border p-2 sm:block", selectedJob.color)}
              >
                <IconComponent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-foreground text-sm font-bold">{selectedJob.title}</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {selectedJob.description}
                </p>
              </div>
            </div>

            <CronSchedule
              expression={selectedJob.expression}
              title=""
              showNextRuns={5}
              className="border-border/30 bg-card/20 backdrop-blur-md"
            />
          </div>

          <div className="text-muted-foreground bg-muted/20 border-border/10 mt-4 flex items-center gap-2 rounded-lg border p-2.5 text-[10px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>All background tasks run in production via the custom express server.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
