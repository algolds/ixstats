"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";

export interface StandingsRow {
  id: string;
  teamId: string;
  teamName?: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  rank?: number;
  division?: string;
  conference?: string;
  color?: string; // team hex color
}

interface Standings1Props {
  title?: string;
  standings: StandingsRow[];
  promotionCount?: number | null;
  relegationCount?: number | null;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

export default function Standings1({
  title = "League Standings",
  standings,
  promotionCount = 0,
  relegationCount = 0,
  hasParentLeague = false,
  hasSubLeagues = false,
  onTeamClick,
  className,
}: Standings1Props) {
  if (!standings || standings.length === 0) {
    return (
      <div className={cn("text-muted-foreground mx-auto w-full py-8 text-center", className)}>
        No standings data yet.
      </div>
    );
  }

  const hasDivisions = standings.some((s) => s.division);
  const hasConferences = standings.some((s) => s.conference);

  // Helper to group standings
  const groupByConferenceDivision = (rows: StandingsRow[]) => {
    const groups = new Map<string, { label: string; standings: StandingsRow[] }>();
    for (const s of rows) {
      const conference = s.conference ?? "";
      const division = s.division ?? "";
      const key = `${conference}|${division}`;
      if (!groups.has(key)) {
        const parts: string[] = [];
        if (conference) parts.push(conference);
        if (division) parts.push(division);
        groups.set(key, { label: parts.join(" — "), standings: [] });
      }
      groups.get(key)!.standings.push(s);
    }
    return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
  };

  const renderTable = (rows: StandingsRow[]) => {
    const totalTeams = rows.length;
    const promoLimit = promotionCount ?? 0;
    const relegLimit = relegationCount ?? 0;

    return (
      <div className="border-border/20 bg-muted/30 overflow-x-auto rounded-2xl border dark:bg-slate-950/20">
        <table className="min-w-full table-auto border-collapse border-spacing-px text-sm">
          <thead className="bg-muted/50 text-foreground text-xs font-bold tracking-wider uppercase dark:bg-slate-900/40">
            <tr>
              <th scope="col" className="w-16 px-4 py-3 text-start">
                #
              </th>
              <th scope="col" className="px-4 py-3 text-start">
                Team
              </th>
              <th scope="col" className="px-2.5 py-3 text-center">
                W
              </th>
              <th scope="col" className="px-2.5 py-3 text-center">
                L
              </th>
              <th scope="col" className="px-2.5 py-3 text-center">
                D
              </th>
              <th scope="col" className="px-2.5 py-3 text-center font-extrabold">
                PTS
              </th>
              <th scope="col" className="px-4 py-3 text-end">
                DIFF
              </th>
            </tr>
          </thead>
          <tbody className="divide-border/20 text-foreground divide-y bg-transparent">
            {rows.map((team, index) => {
              const isPromotionZone = index < promoLimit && hasParentLeague;
              const isRelegationZone = index >= totalTeams - relegLimit && hasSubLeagues;
              const teamColor = team.color ?? "#94a3b8";
              const diff = team.pointsFor - team.pointsAgainst;
              const diffStr = diff > 0 ? `+${diff}` : String(diff);

              return (
                <tr
                  key={team.id}
                  className={cn(
                    "hover:bg-muted/40 transition-colors dark:hover:bg-slate-900/20",
                    isPromotionZone &&
                      "border-l-4 border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10",
                    isRelegationZone &&
                      "border-l-4 border-l-red-500 bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/5 dark:hover:bg-red-500/10"
                  )}
                >
                  <td className="px-4 py-3 font-bold whitespace-nowrap">
                    {team.rank ?? index + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onTeamClick?.(team.teamId)}
                        className="group flex cursor-pointer items-center gap-2 text-left font-bold hover:underline"
                      >
                        <svg
                          viewBox="0 0 420 420"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110"
                          style={{ color: teamColor }}
                        >
                          <path
                            d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                            fill="currentColor"
                          />
                        </svg>
                        <span className="truncate">{team.teamName ?? team.teamId}</span>
                      </button>
                      {isPromotionZone && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          P
                        </span>
                      )}
                      {isRelegationZone && (
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-red-600 dark:bg-red-500/20 dark:text-red-400">
                          R
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2.5 py-3 text-center whitespace-nowrap">{team.wins}</td>
                  <td className="text-muted-foreground px-2.5 py-3 text-center whitespace-nowrap">
                    {team.losses}
                  </td>
                  <td className="px-2.5 py-3 text-center whitespace-nowrap">{team.draws}</td>
                  <td className="px-2.5 py-3 text-center font-bold whitespace-nowrap">
                    {team.points}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-end font-semibold whitespace-nowrap">
                    {diffStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const grouped = hasConferences || hasDivisions ? groupByConferenceDivision(standings) : null;

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn(
        "border-border/40 bg-card/90 mx-auto w-full max-w-[650px] rounded-3xl border p-6 shadow-xl",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-foreground text-lg font-extrabold">{title}</h3>
      </div>

      <div className="space-y-6">
        {grouped
          ? grouped.map((group) => (
              <div key={group.key} className="space-y-2">
                {group.label && (
                  <h4 className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase">
                    {group.label}
                  </h4>
                )}
                {renderTable(group.standings)}
              </div>
            ))
          : renderTable(standings)}
      </div>
    </FacetCard>
  );
}
