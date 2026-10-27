"use client";

import React from "react";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { nationalSubScores } from "~/lib/military/defense-console";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";
import { DefenseWarnings } from "./DefenseWarnings";
import { NationalForceCard } from "./NationalForceCard";
import { ReadinessCard } from "./ReadinessCard";
import { BranchReadinessTable } from "./BranchReadinessTable";

interface DefenseOverviewProps {
  overview: OwnerDefense;
  reader: RealmClockReader | null;
  nowClockMs: number;
}

/** The staff summary: warnings first, then strength and posture, readiness, and each branch's rating. */
export function DefenseOverview({ overview, reader, nowClockMs }: DefenseOverviewProps) {
  return (
    <div className="space-y-4">
      <DefenseWarnings warnings={overview.warnings} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <NationalForceCard overview={overview} reader={reader} nowClockMs={nowClockMs} />
        <ReadinessCard
          title="National readiness"
          readiness={overview.readiness}
          cLevel={overview.cLevel}
          subScores={nationalSubScores(overview.branches)}
        />
      </div>
      <BranchReadinessTable branches={overview.branches} />
    </div>
  );
}
