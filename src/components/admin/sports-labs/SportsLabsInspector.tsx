"use client";

import React, { useState } from "react";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import {
  Trophy,
  Group as Users,
  Calendar,
  Tournament as Swords,
  ControlSlider as Sliders,
} from "iconoir-react";
import type { SportPresetKey } from "~/lib/sports";

import { PresetsInspectorNode } from "./nodes/PresetsInspectorNode";
import { RostersInspectorNode } from "./nodes/RostersInspectorNode";
import { ScheduleInspectorNode } from "./nodes/ScheduleInspectorNode";
import { ResolverInspectorNode } from "./nodes/ResolverInspectorNode";
import { StandingsInspectorNode } from "./nodes/StandingsInspectorNode";
import { AgingInspectorNode } from "./nodes/AgingInspectorNode";

interface SportsLabsInspectorProps {
  selectedNodeId: string;
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  setSelectedSport: (sport: SportPresetKey) => void;
  className?: string;
}

export function SportsLabsInspector({
  selectedNodeId,
  isSandbox,
  selectedSport,
  setSelectedSport,
  className,
}: SportsLabsInspectorProps) {
  // Shared DB navigation state across inspector nodes
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const nodeHeaders: Record<string, { title: string; icon: typeof Trophy; subtitle: string }> = {
    presets: { title: "Sport Presets", icon: Trophy, subtitle: "Manage presets & formats" },
    rosters: { title: "Talent & Roster Gen", icon: Users, subtitle: "Configure coaches & players" },
    schedule: {
      title: "Schedule Generator",
      icon: Calendar,
      subtitle: "Inspect fixture format rules",
    },
    resolver: { title: "Match Resolver", icon: Swords, subtitle: "Seeded match simulator" },
    standings: { title: "Standings & Table", icon: Trophy, subtitle: "Compute standings ranks" },
    aging: { title: "Aging & Retirements", icon: Sliders, subtitle: "Career chain progression" },
  };

  const currentHeader = nodeHeaders[selectedNodeId] ?? {
    title: "Node Inspector",
    icon: Trophy,
    subtitle: "Select a node to inspect its pipeline",
  };
  const HeaderIcon = currentHeader.icon;

  return (
    <Card className={cn("facet-card bg-card/60 flex h-full flex-col backdrop-blur-md", className)}>
      <CardHeader className="border-border/40 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <HeaderIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{currentHeader.title}</CardTitle>
            <CardDescription className="text-[11px]">{currentHeader.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        {selectedNodeId === "presets" && (
          <PresetsInspectorNode
            isSandbox={isSandbox}
            selectedSport={selectedSport}
            setSelectedSport={setSelectedSport}
          />
        )}
        {selectedNodeId === "rosters" && (
          <RostersInspectorNode
            isSandbox={isSandbox}
            selectedSport={selectedSport}
            selectedLeagueId={selectedLeagueId}
            setSelectedLeagueId={setSelectedLeagueId}
            selectedTeamId={selectedTeamId}
            setSelectedTeamId={setSelectedTeamId}
          />
        )}
        {selectedNodeId === "schedule" && (
          <ScheduleInspectorNode
            isSandbox={isSandbox}
            selectedSport={selectedSport}
            selectedLeagueId={selectedLeagueId}
            setSelectedLeagueId={setSelectedLeagueId}
            selectedSeasonId={selectedSeasonId}
            setSelectedSeasonId={setSelectedSeasonId}
          />
        )}
        {selectedNodeId === "resolver" && (
          <ResolverInspectorNode
            isSandbox={isSandbox}
            selectedSport={selectedSport}
            selectedLeagueId={selectedLeagueId}
            setSelectedLeagueId={setSelectedLeagueId}
            selectedSeasonId={selectedSeasonId}
            setSelectedSeasonId={setSelectedSeasonId}
          />
        )}
        {selectedNodeId === "standings" && (
          <StandingsInspectorNode
            isSandbox={isSandbox}
            selectedSport={selectedSport}
            selectedLeagueId={selectedLeagueId}
            setSelectedLeagueId={setSelectedLeagueId}
            selectedSeasonId={selectedSeasonId}
            setSelectedSeasonId={setSelectedSeasonId}
          />
        )}
        {selectedNodeId === "aging" && (
          <AgingInspectorNode
            isSandbox={isSandbox}
            selectedSport={selectedSport}
            selectedLeagueId={selectedLeagueId}
            setSelectedLeagueId={setSelectedLeagueId}
            selectedSeasonId={selectedSeasonId}
            setSelectedSeasonId={setSelectedSeasonId}
          />
        )}
      </CardContent>
    </Card>
  );
}
