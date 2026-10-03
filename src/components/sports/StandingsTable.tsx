"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import {
  OpenBook as BookOpen,
  Download,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
} from "iconoir-react";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

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
      <div
        className={cn(
          "text-label-secondary text-footnote mx-auto w-full py-12 text-center font-semibold",
          className
        )}
      >
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
        groups.set(key, { label: parts.join(" · "), standings: [] });
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
    <Card
      className={cn(
        "border-separator bg-surface rounded-sheet shadow-card mx-auto w-full overflow-hidden border p-6",
        className
      )}
    >
      {/* Table Title and Export Button */}
      <div className="border-separator mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-label text-title-2">{title}</h3>
          <p className="text-footnote text-label-secondary mt-0.5 font-medium">
            Live season table with qualification zones and team form momentum.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportStandingsCsv(title, standings)}
          title="Export CSV"
          className="text-label-secondary w-fit"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export matrix</span>
        </Button>
      </div>

      {groups.map((group, groupIdx) => (
        <div key={groupIdx} className="mb-8 last:mb-0">
          {group.label && (
            <div className="text-label-secondary border-separator text-eyebrow mb-3 flex items-center gap-2 border-b pb-2">
              <span className="bg-tint h-2 w-2 rounded-full" />
              <span>{group.label}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="text-footnote w-full border-collapse text-left">
              <thead>
                <tr className="text-label-secondary border-separator text-eyebrow border-b">
                  <th className="w-14 py-3 pl-3 text-center">Rank</th>
                  <th className="py-3">Franchise</th>
                  <th className="py-3 text-center">GP</th>
                  <th className="py-3 text-center">W</th>
                  <th className="py-3 text-center">D</th>
                  <th className="py-3 text-center">L</th>
                  <th className="py-3 text-center">DIFF</th>
                  <th className="text-label py-3 text-center font-semibold">PTS</th>
                  <th className="py-3 pr-3 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-separator divide-y">
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
                        "group cursor-pointer transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
                        isLeader && "bg-yellow/5 hover:bg-yellow/10",
                        isPromotion && !isLeader && "bg-green/5 hover:bg-green/10",
                        isRelegation && "bg-red/5 hover:bg-red/10",
                        !isLeader && !isPromotion && !isRelegation && "hover:bg-fill-3"
                      )}
                      onClick={() => handleRowClick(team.teamId)}
                    >
                      {/* Rank with indicator */}
                      <td className="py-3 pl-3 text-center font-semibold">
                        <div className="flex items-center justify-center gap-2">
                          {isLeader ? (
                            <span className="bg-yellow/20 text-footnote text-yellow flex h-5 w-5 items-center justify-center rounded-full font-semibold">
                              1
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "text-footnote font-semibold tabular-nums",
                                isPromotion
                                  ? "text-green"
                                  : isRelegation
                                    ? "text-red"
                                    : "text-label-secondary"
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
                          <div className="border-separator bg-background rounded-row shadow-card flex aspect-square w-7 shrink-0 items-center justify-center border p-0.5">
                            {team.logo ? (
                              <img
                                src={withBasePath(team.logo)}
                                alt={team.teamName || team.teamId}
                                className="rounded-control h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: teamColor }}
                              />
                            )}
                          </div>
                          <span className="text-label text-footnote group-hover:text-tint font-semibold transition-colors">
                            {team.teamName || team.teamId}
                          </span>
                          {team.wikiSlug && (
                            <Link
                              href={titleToWikiOSPath(team.wikiSlug)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-label-secondary hover:text-label opacity-60 transition-opacity hover:opacity-100"
                              title={`Wiki: ${team.teamName}`}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="text-label-secondary py-3 text-center font-semibold tabular-nums">
                        {played}
                      </td>
                      <td className="text-label py-3 text-center font-semibold tabular-nums">
                        {team.wins}
                      </td>
                      <td className="text-label-secondary py-3 text-center font-semibold tabular-nums">
                        {team.draws}
                      </td>
                      <td className="text-label-secondary py-3 text-center font-semibold tabular-nums">
                        {team.losses}
                      </td>
                      <td className="text-label-secondary py-3 text-center font-semibold tabular-nums">
                        <span className={cn(diff > 0 && "text-green", diff < 0 && "text-red")}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="text-label text-headline py-3 text-center tabular-nums">
                        {team.points}
                      </td>

                      {/* Recent Form Pills */}
                      <td className="py-3 pr-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {form.map((res, i) => (
                            <span
                              key={i}
                              className={cn(
                                "rounded-control-sm text-eyebrow shadow-card flex h-4.5 w-4.5 items-center justify-center",
                                res === "W" && "bg-green/20 text-green border-green/30 border",
                                res === "D" && "bg-yellow/20 text-yellow border-yellow/30 border",
                                res === "L" && "bg-red/20 text-red border-red/30 border"
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
    </Card>
  );
}

export default StandingsTable;
