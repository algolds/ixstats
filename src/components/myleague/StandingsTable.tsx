"use client";

import { cn } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { EnhancedTooltip } from "~/components/ui/enhanced-tooltip";

interface StandingsTableProps {
  standings: Array<{
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
  }>;
  sportPreset?: string;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

interface StandingsTableProps {
  standings: Array<{
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
  }>;
  sportPreset?: string;
  promotionCount?: number;
  relegationCount?: number;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

export function StandingsTable({
  standings,
  promotionCount = 0,
  relegationCount = 0,
  hasParentLeague = false,
  hasSubLeagues = false,
  onTeamClick,
  className,
}: StandingsTableProps) {
  if (!standings || standings.length === 0) {
    return null;
  }

  const hasDivisions = standings.some((s) => s.division);
  const hasConferences = standings.some((s) => s.conference);

  if (hasConferences || hasDivisions) {
    const grouped = groupByConferenceDivision(standings);

    return (
      <div className={cn("space-y-6", className)}>
        {grouped.map((group) => (
          <div key={group.key}>
            {group.label && (
              <h3 className="text-muted-foreground mb-3 text-sm font-semibold">{group.label}</h3>
            )}
            <StandingsTableInner
              standings={group.standings}
              promotionCount={promotionCount}
              relegationCount={relegationCount}
              hasParentLeague={hasParentLeague}
              hasSubLeagues={hasSubLeagues}
              onTeamClick={onTeamClick}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <StandingsTableInner
      standings={standings}
      promotionCount={promotionCount}
      relegationCount={relegationCount}
      hasParentLeague={hasParentLeague}
      hasSubLeagues={hasSubLeagues}
      onTeamClick={onTeamClick}
      className={className}
    />
  );
}

function StandingsTableInner({
  standings,
  promotionCount = 0,
  relegationCount = 0,
  hasParentLeague = false,
  hasSubLeagues = false,
  onTeamClick,
  className,
}: {
  standings: StandingsTableProps["standings"];
  promotionCount?: number;
  relegationCount?: number;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}) {
  const totalTeams = standings.length;

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <EnhancedTooltip content="Rank / Seed">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                POS
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead>Team</TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Wins">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                W
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Losses">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                L
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Draws">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                D
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Points">
              <span className="decoration-border/60 cursor-help font-bold underline decoration-dotted">
                Pts
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Points For (Goals/Points Scored)">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                PF
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Points Against (Goals/Points Allowed)">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                PA
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Games Played (Total matches played this season)">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                GP
              </span>
            </EnhancedTooltip>
          </TableHead>
          <TableHead className="text-center">
            <EnhancedTooltip content="Point Differential (PF minus PA)">
              <span className="decoration-border/60 cursor-help underline decoration-dotted">
                DIFF
              </span>
            </EnhancedTooltip>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => {
          const isPromotionZone = i < promotionCount && hasParentLeague;
          const isRelegationZone = i >= totalTeams - relegationCount && hasSubLeagues;

          return (
            <TableRow
              key={s.id}
              className={cn(
                isPromotionZone &&
                  "border-l-2 border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10",
                isRelegationZone && "border-l-2 border-l-red-500 bg-red-500/5 hover:bg-red-500/10"
              )}
            >
              <TableCell className="font-medium">{s.rank ?? i + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTeamClick?.(s.teamId)}
                    className="text-left hover:underline cursor-pointer"
                  >
                    {s.teamName ?? s.teamId}
                  </button>
                  {isPromotionZone && (
                    <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-semibold whitespace-nowrap text-emerald-400">
                      Promotion Zone
                    </span>
                  )}
                  {isRelegationZone && (
                    <span className="rounded bg-red-500/15 px-1 text-[9px] font-semibold whitespace-nowrap text-red-400">
                      Relegation Zone
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">{s.wins}</TableCell>
              <TableCell className="text-center">{s.losses}</TableCell>
              <TableCell className="text-center">{s.draws}</TableCell>
              <TableCell className="text-center font-bold">{s.points}</TableCell>
              <TableCell className="text-center">{s.pointsFor}</TableCell>
              <TableCell className="text-center">{s.pointsAgainst}</TableCell>
              <TableCell className="text-center">{s.wins + s.losses + s.draws}</TableCell>
              <TableCell className="text-center">
                {(() => {
                  const diff = s.pointsFor - s.pointsAgainst;
                  return diff > 0 ? `+${diff}` : String(diff);
                })()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function groupByConferenceDivision(
  standings: StandingsTableProps["standings"]
): Array<{ key: string; label: string; standings: StandingsTableProps["standings"] }> {
  const groups = new Map<string, { label: string; standings: StandingsTableProps["standings"] }>();

  for (const s of standings) {
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
}
