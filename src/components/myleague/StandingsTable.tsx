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
  className?: string;
}

export function StandingsTable({ standings, className }: StandingsTableProps) {
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
              <h3 className="text-muted-foreground mb-3 text-sm font-semibold">
                {group.label}
              </h3>
            )}
            <StandingsTableInner standings={group.standings} />
          </div>
        ))}
      </div>
    );
  }

  return <StandingsTableInner standings={standings} className={className} />;
}

function StandingsTableInner({
  standings,
  className,
}: {
  standings: StandingsTableProps["standings"];
  className?: string;
}) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Team</TableHead>
          <TableHead className="text-center">W</TableHead>
          <TableHead className="text-center">L</TableHead>
          <TableHead className="text-center">D</TableHead>
          <TableHead className="text-center">Pts</TableHead>
          <TableHead className="text-center">PF</TableHead>
          <TableHead className="text-center">PA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.rank ?? i + 1}</TableCell>
            <TableCell>
              <span>{s.teamName ?? s.teamId}</span>
            </TableCell>
            <TableCell className="text-center">{s.wins}</TableCell>
            <TableCell className="text-center">{s.losses}</TableCell>
            <TableCell className="text-center">{s.draws}</TableCell>
            <TableCell className="text-center font-bold">{s.points}</TableCell>
            <TableCell className="text-center">{s.pointsFor}</TableCell>
            <TableCell className="text-center">{s.pointsAgainst}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function groupByConferenceDivision(
  standings: StandingsTableProps["standings"],
): Array<{ key: string; label: string; standings: StandingsTableProps["standings"] }> {
  const groups = new Map<
    string,
    { label: string; standings: StandingsTableProps["standings"] }
  >();

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
