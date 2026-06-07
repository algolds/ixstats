"use client";

import { useMemo } from "react";
import { Users, Landmark, BarChart3, CheckCircle } from "lucide-react";
import { api } from "~/trpc/react";
import {
  SectionContextWidget,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface PoliticsSidebarWidgetProps {
  countryId: string;
}

/**
 * Politics context widget — a thin adapter that feeds the unified
 * SectionContextWidget with quick stats (parties / seats / elections)
 * and a recent-activity log (legislature, parties, elections).
 */
export function PoliticsSidebarWidget({ countryId }: PoliticsSidebarWidgetProps) {
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    const partyCount = parties?.length ?? 0;
    const totalSeats = legislature?.totalSeats ?? 0;
    const electionCount = elections?.length ?? 0;
    return [
      { label: "Parties", value: partyCount, accentText: true },
      { label: "Seats", value: totalSeats, accentText: true },
      { label: "Elections", value: electionCount, accentText: true },
    ];
  }, [parties, legislature, elections]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    const entries: ContextActivityEntry[] = [];

    // Legislature configured
    if (legislature && legislature.totalSeats > 0) {
      entries.push({
        id: "legislature",
        icon: Landmark,
        iconColor: "text-indigo-500",
        text: `Legislature: ${legislature.totalSeats} seats configured`,
        time: new Date(
          (legislature as any).updatedAt ?? (legislature as any).createdAt ?? Date.now()
        ),
      });
    }

    // Parties created
    parties?.forEach((p: any) => {
      entries.push({
        id: `party-${p.id}`,
        icon: Users,
        iconColor: "text-purple-500",
        text: `Party: ${p.name} (${p.ideology?.replace(/_/g, " ")})`,
        time: new Date(p.createdAt),
      });
    });

    // Elections
    elections?.forEach((e: any) => {
      const isCompleted = e.status === "COMPLETED" || e.status === "completed";
      entries.push({
        id: `election-${e.id}`,
        icon: isCompleted ? CheckCircle : BarChart3,
        iconColor: isCompleted ? "text-green-500" : "text-violet-500",
        text: isCompleted
          ? `Completed: ${e.name ?? "Election"}`
          : `Scheduled: ${e.name ?? "Election"}`,
        time: new Date(e.updatedAt ?? e.createdAt),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [parties, elections, legislature]);

  return (
    <SectionContextWidget
      accent="indigo"
      title="Political Log"
      stats={stats}
      activity={activity}
      emptyMessage="No political activity yet"
    />
  );
}
