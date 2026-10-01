"use client";
// src/app/admin/_components/SystemCronScheduleWidget.tsx
// Visualizes and diagnoses the system cron jobs / background tasks

import React, { useState } from "react";
import { CronSchedule } from "./CronSchedule";
import { cn } from "~/lib/utils";
import {
  Hammer as Gavel,
  Coins,
  GraphUp as LineChart,
  Sparks as Sparkles,
  Refresh as RefreshCw,
  Trophy as Award,
  Clock,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";

const CRON_JOBS = [
  {
    id: "auctions",
    title: "Auction Completion",
    description: "Processes expired auctions, determines winners, and handles payouts.",
    expression: "* * * * *",
    icon: Gavel,
    color: "text-yellow border-yellow/20 bg-yellow/5",
  },
  {
    id: "passive-income",
    title: "Passive Income Distribution",
    description: "Calculates and deposits passive income for all qualifying nations daily.",
    expression: "0 0 * * *",
    icon: Coins,
    color: "text-green border-green/20 bg-green/5",
  },
  {
    id: "card-value",
    title: "Card Value Tracking",
    description: "Updates evaluation metrics, market trends, and historic valuations for cards.",
    expression: "0 */6 * * *",
    icon: LineChart,
    color: "text-blue border-blue/20 bg-blue/5",
  },
  {
    id: "lore-cards",
    title: "Lore Card Generation",
    description: "Triggers AI-generated narrative events and special lore card drops.",
    expression: "0 2 * * *",
    icon: Sparkles,
    color: "text-purple border-purple/20 bg-purple/5",
  },
  {
    id: "twitter-sync",
    title: "IxTwitter Discord Sync",
    description: "Pulls recent social alerts and synchronizes them to ThinkPages.",
    expression: "0 * * * *",
    icon: RefreshCw,
    color: "text-indigo border-indigo/20 bg-indigo/5",
  },
  {
    id: "lorewards",
    title: "Lorewards fullSync",
    description: "Performs full synchronization of system rewards, roles, and achievements.",
    expression: "0 6 * * *",
    icon: Award,
    color: "text-red border-red/20 bg-red/5",
  },
] as const;

export function SystemCronScheduleWidget() {
  const [selectedId, setSelectedId] = useState<string>("auctions");
  const selectedJob = CRON_JOBS.find((job) => job.id === selectedId) ?? CRON_JOBS[0];

  const IconComponent = selectedJob.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-label text-headline flex items-center gap-2">
          <Clock className="text-tint h-4.5 w-4.5" />
          System Cron Schedules
        </h2>
        <Badge variant="tinted">UTC Reference</Badge>
      </div>

      <div className="border-separator rounded-row flex min-h-[380px] flex-1 flex-col gap-4 p-4 md:flex-row">
        {/* Left Side: Cron List */}
        <div className="border-separator flex w-full flex-col gap-2 border-b pb-4 md:w-2/5 md:border-r md:border-b-0 md:pr-4 md:pb-0">
          <FacetListSection
            header="Registered tasks"
            variant="plain"
            groupClassName="max-h-[300px] overflow-y-auto md:max-h-[340px]"
          >
            {CRON_JOBS.map((job) => {
              const JobIcon = job.icon;
              return (
                <FacetRow
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  selected={job.id === selectedId}
                  selectionStyle="tint"
                  leading={
                    <span className={cn("rounded-control shrink-0 border p-2", job.color)}>
                      <JobIcon aria-hidden className="size-4" />
                    </span>
                  }
                  title={job.title}
                  subtitle={<code className="font-mono">{job.expression}</code>}
                />
              );
            })}
          </FacetListSection>
        </div>

        {/* Right Side: Visualizer */}
        <div className="flex w-full flex-col justify-between md:w-3/5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "rounded-control hidden shrink-0 border p-2 sm:block",
                  selectedJob.color
                )}
              >
                <IconComponent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-label text-headline">{selectedJob.title}</h3>
                <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
                  {selectedJob.description}
                </p>
              </div>
            </div>

            <CronSchedule
              expression={selectedJob.expression}
              title=""
              showNextRuns={5}
              className="border-separator bg-surface"
            />
          </div>

          <div className="text-label-secondary bg-fill-4 border-separator rounded-control text-footnote mt-4 flex items-center gap-2 border p-3">
            <span className="relative flex h-2 w-2">
              <span className="bg-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
              <span className="bg-green relative inline-flex h-2 w-2 rounded-full"></span>
            </span>
            <span>All background tasks run in production via the custom express server.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
