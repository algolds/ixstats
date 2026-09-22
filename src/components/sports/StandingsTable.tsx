"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { OpenBook as BookOpen, Download, StatUp as TrendingUp, StatDown as TrendingDown } from "iconoir-react";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";

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
  rankDelta?: number; // e.g. +2, -1, 0
  recentForm?: Array<"W" | "D" | "L">;
  division?: string;
  conference?: string;
  color?: string;
  logo?: string | null;
  wikiSlug?: string | null;
}

function exportStandingsCsv(title: string, rows: StandingsRow[]) {
  const header = ["Rank", "Team", "GP", "W", "L", "D", "PF", "PA", "Diff", "Pts"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r, i) =>
    [
      r.rank ?? i + 1,
      r.teamName ?? r.teamId,
      r.wins + r.losses + r.draws,
      r.wins,
      r.losses,
      r.draws,
      r.pointsFor,
      r.pointsAgainst,
      r.pointsFor - r.pointsAgainst,
      r.points,
    ]
      .map(esc)
      .join(",")
  );
  const csv = [header.map(esc).join(","), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-standings.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface StandingsTableProps {
  title?: string;
  standings: StandingsRow[];
  promotionCount?: number | null;
  relegationCount?: number | null;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

export function StandingsTable({
  title = "Competition Standings Matrix",
  standings,
  promotionCount = 0,
  relegationCount = 0,
  hasParentLeague = false,
  hasSubLeagues = false,
  onTeamClick,
  className,
}: StandingsTableProps) {
  const { focusOrganization } = useSportsFocus();

  if (!standings || standings.length === 0) {
    return (
      <div className={cn("text-muted-foreground mx-auto w-full py-12 text-center text-xs font-semibold", className)}>
        No standings data recorded for this season yet.
      </div>
    );
  }

  const hasDivisions = standings.some((s) => s.division);
  const hasConferences = standings.some((s) => s.conference);

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
    return Array.from(groups.values());
  };

  const groups =
    hasConferences || hasDivisions
      ? groupByConferenceDivision(standings)
      : [{ label: "", standings }];

  const handleRowClick = (teamId: string) => {
    if (onTeamClick) {
      onTeamClick(teamId);
    } else {
      focusOrganization(teamId);
    }
  };

  return (
    <FacetCard
      depth={2}
      className={cn(
        "border-border/40 bg-card/85 mx-auto w-full overflow-hidden rounded-3xl border p-6 shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      {/* Table Title and Export Button */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-4">
        <div>
          <h3 className="text-foreground text-xl font-black tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            Live season table with qualification zones and team form momentum.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportStandingsCsv(title, standings)}
          data-cuelume-press="subtle"
          className="text-muted-foreground hover:text-foreground border-border/40 bg-muted/40 hover:bg-muted/70 flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-[0.98] w-fit"
          title="Export CSV"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Matrix</span>
        </button>
      </div>

      {groups.map((group, groupIdx) => (
        <div key={groupIdx} className="mb-8 last:mb-0">
          {group.label && (
            <div className="text-muted-foreground mb-3 border-b border-border/30 pb-1.5 text-xs font-black tracking-wider uppercase flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span>{group.label}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30 text-xs font-black tracking-wider uppercase">
                  <th className="w-14 py-3 pl-3 text-center">Rank</th>
                  <th className="py-3">Franchise</th>
                  <th className="py-3 text-center">GP</th>
                  <th className="py-3 text-center">W</th>
                  <th className="py-3 text-center">D</th>
                  <th className="py-3 text-center">L</th>
                  <th className="py-3 text-center">DIFF</th>
                  <th className="text-foreground py-3 text-center font-black">PTS</th>
                  <th className="py-3 pr-3 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {group.standings.map((team, idx) => {
                  const played = team.wins + team.losses + team.draws;
                  const diff = team.pointsFor - team.pointsAgainst;
                  const teamColor = team.color ?? "#3b82f6";
                  const rank = team.rank ?? idx + 1;

                  const isLeader = rank === 1;
                  const isPromotion =
                    hasParentLeague && (promotionCount ?? 0) > 0 && rank <= (promotionCount ?? 0);
                  const isRelegation =
                    hasSubLeagues &&
                    (relegationCount ?? 0) > 0 &&
                    rank > group.standings.length - (relegationCount ?? 0);

                  // Mock dynamic form if not available
                  const form = team.recentForm ?? [
                    team.wins > 0 ? "W" : "D",
                    team.wins > 1 ? "W" : "L",
                    team.draws > 0 ? "D" : "W",
                  ];

                  return (
                    <tr
                      key={team.id || team.teamId}
                      className={cn(
                        "group transition-all duration-150 cursor-pointer active:scale-[0.99]",
                        isLeader && "bg-amber-500/5 hover:bg-amber-500/10",
                        isPromotion && !isLeader && "bg-emerald-500/5 hover:bg-emerald-500/10",
                        isRelegation && "bg-red-500/5 hover:bg-red-500/10",
                        !isLeader && !isPromotion && !isRelegation && "hover:bg-muted/40"
                      )}
                      onClick={() => handleRowClick(team.teamId)}
                    >
                      {/* Rank with indicator */}
                      <td className="py-3 pl-3 text-center font-black">
                        <div className="flex items-center justify-center gap-1.5">
                          {isLeader ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-black text-amber-400">
                              1
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "text-xs font-bold tabular-nums",
                                isPromotion
                                  ? "text-emerald-400"
                                  : isRelegation
                                    ? "text-red-400"
                                    : "text-muted-foreground"
                              )}
                            >
                              {rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Team Name and Logo */}
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="border-border/40 bg-background flex aspect-square w-7 shrink-0 items-center justify-center rounded-xl border p-0.5 shadow-sm">
                            {team.logo ? (
                              <img
                                src={withBasePath(team.logo)}
                                alt={team.teamName || team.teamId}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: teamColor }}
                              />
                            )}
                          </div>
                          <span className="text-foreground text-xs font-extrabold tracking-tight group-hover:text-primary transition-colors">
                            {team.teamName || team.teamId}
                          </span>
                          {team.wikiSlug && (
                            <Link
                              href={titleToWikiOSPath(team.wikiSlug)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground opacity-60 transition-opacity hover:opacity-100"
                              title={`Wiki: ${team.teamName}`}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="py-3 text-center font-semibold text-muted-foreground tabular-nums">
                        {played}
                      </td>
                      <td className="py-3 text-center font-bold text-foreground tabular-nums">
                        {team.wins}
                      </td>
                      <td className="py-3 text-center font-semibold text-muted-foreground tabular-nums">
                        {team.draws}
                      </td>
                      <td className="py-3 text-center font-semibold text-muted-foreground tabular-nums">
                        {team.losses}
                      </td>
                      <td className="py-3 text-center font-bold text-muted-foreground tabular-nums">
                        <span className={cn(diff > 0 && "text-emerald-400", diff < 0 && "text-red-400")}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-3 text-center font-black text-foreground tabular-nums text-sm">
                        {team.points}
                      </td>

                      {/* Recent Form Pills */}
                      <td className="py-3 pr-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {form.map((res, i) => (
                            <span
                              key={i}
                              className={cn(
                                "flex h-4.5 w-4.5 items-center justify-center rounded-md text-xs font-black uppercase shadow-xs",
                                res === "W" && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                                res === "D" && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                                res === "L" && "bg-red-500/20 text-red-400 border border-red-500/30"
                              )}
                            >
                              {res}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </FacetCard>
  );
}

export default StandingsTable;
