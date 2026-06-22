"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { cn } from "~/lib/utils";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { EnhancedTooltip } from "~/components/ui/enhanced-tooltip";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { TableVirtuoso } from "react-virtuoso";

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

type StandingRow = StandingsTableProps["standings"][number];

export function StandingsTable({
  standings,
  sportPreset: _sportPreset,
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
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<StandingRow>[]>(
    () => [
      {
        id: "rank",
        accessorFn: (row) => row.rank,
        header: () => (
          <EnhancedTooltip content="Rank / Seed">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">
              POS
            </span>
          </EnhancedTooltip>
        ),
        cell: ({ row, getValue }) => {
          const val = getValue<number | undefined>();
          return val !== undefined ? val : row.index + 1;
        },
      },
      {
        id: "team",
        accessorFn: (row) => row.teamName ?? row.teamId,
        header: "Team",
        cell: ({ row }) => {
          const s = row.original;
          const i = row.index;
          const isPromotionZone = i < promotionCount && hasParentLeague;
          const isRelegationZone = i >= standings.length - relegationCount && hasSubLeagues;

          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onTeamClick?.(s.teamId)}
                className="cursor-pointer text-left font-medium hover:underline"
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
          );
        },
      },
      {
        accessorKey: "wins",
        header: () => (
          <EnhancedTooltip content="Wins">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">W</span>
          </EnhancedTooltip>
        ),
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: "losses",
        header: () => (
          <EnhancedTooltip content="Losses">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">L</span>
          </EnhancedTooltip>
        ),
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: "draws",
        header: () => (
          <EnhancedTooltip content="Draws">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">D</span>
          </EnhancedTooltip>
        ),
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: "points",
        header: () => (
          <EnhancedTooltip content="Points">
            <span className="decoration-border/60 cursor-help font-bold underline decoration-dotted">
              Pts
            </span>
          </EnhancedTooltip>
        ),
        cell: ({ getValue }) => <span className="font-bold">{getValue<number>()}</span>,
      },
      {
        accessorKey: "pointsFor",
        header: () => (
          <EnhancedTooltip content="Points For (Goals/Points Scored)">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">PF</span>
          </EnhancedTooltip>
        ),
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: "pointsAgainst",
        header: () => (
          <EnhancedTooltip content="Points Against (Goals/Points Allowed)">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">PA</span>
          </EnhancedTooltip>
        ),
        cell: ({ getValue }) => getValue(),
      },
      {
        id: "gamesPlayed",
        header: () => (
          <EnhancedTooltip content="Games Played (Total matches played this season)">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">GP</span>
          </EnhancedTooltip>
        ),
        accessorFn: (row) => row.wins + row.losses + row.draws,
        cell: ({ getValue }) => getValue(),
      },
      {
        id: "difference",
        header: () => (
          <EnhancedTooltip content="Point Differential (PF minus PA)">
            <span className="decoration-border/60 cursor-help underline decoration-dotted">
              DIFF
            </span>
          </EnhancedTooltip>
        ),
        accessorFn: (row) => row.pointsFor - row.pointsAgainst,
        cell: ({ getValue }) => {
          const diff = getValue<number>();
          return diff > 0 ? `+${diff}` : String(diff);
        },
      },
    ],
    [standings.length, promotionCount, relegationCount, hasParentLeague, hasSubLeagues, onTeamClick]
  );

  const table = useReactTable({
    data: standings,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const getHeaderClass = (columnId: string) => {
    return cn(
      columnId === "rank" && "w-12",
      columnId !== "rank" && columnId !== "team" && "text-center"
    );
  };

  const getCellClass = (columnId: string) => {
    return cn(
      columnId === "rank" && "font-medium w-12",
      columnId !== "rank" && columnId !== "team" && "text-center"
    );
  };

  const TableComponents = useMemo(
    () => ({
      Table: React.forwardRef<HTMLTableElement, any>(
        ({ className: tableClassName, ...props }, ref) => (
          <table
            ref={ref}
            {...props}
            className={cn("w-full min-w-full caption-bottom text-xs sm:text-sm", tableClassName)}
          />
        )
      ),
      TableHead: React.forwardRef<HTMLTableSectionElement, any>((props, ref) => (
        <TableHeader {...props} ref={ref} />
      )),
      TableBody: React.forwardRef<HTMLTableSectionElement, any>((props, ref) => (
        <TableBody {...props} ref={ref} />
      )),
      TableRow: React.forwardRef<HTMLTableRowElement, any>(({ ...props }, ref) => {
        const index = props["data-index"];
        const row = rows[index];

        const isPromotionZone = row ? row.index < promotionCount && hasParentLeague : false;
        const isRelegationZone = row
          ? row.index >= standings.length - relegationCount && hasSubLeagues
          : false;

        return (
          <TableRow
            ref={ref}
            {...props}
            className={cn(
              isPromotionZone &&
                "border-l-2 border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10",
              isRelegationZone && "border-l-2 border-l-red-500 bg-red-500/5 hover:bg-red-500/10",
              props.className
            )}
          />
        );
      }),
    }),
    [rows, promotionCount, relegationCount, hasParentLeague, hasSubLeagues, standings.length]
  );

  const fixedHeaderContent = () => {
    return table.getHeaderGroups().map((headerGroup) => (
      <TableRow key={headerGroup.id}>
        {headerGroup.headers.map((header) => {
          const canSort = header.column.getCanSort();
          const isSorted = header.column.getIsSorted();
          return (
            <TableHead
              key={header.id}
              className={cn(
                "bg-background sticky top-0 z-10",
                getHeaderClass(header.id),
                canSort && "hover:bg-muted/55 cursor-pointer select-none"
              )}
              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
            >
              {header.isPlaceholder ? null : (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    header.id !== "rank" && header.id !== "team"
                      ? "justify-center"
                      : "justify-start"
                  )}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && (
                    <span className="text-muted-foreground/60 w-3 text-xs">
                      {isSorted === "asc" ? " ▴" : isSorted === "desc" ? " ▾" : ""}
                    </span>
                  )}
                </div>
              )}
            </TableHead>
          );
        })}
      </TableRow>
    ));
  };

  const itemContent = (_index: number, row: any) => {
    return row.getVisibleCells().map((cell: any) => (
      <TableCell key={cell.id} className={getCellClass(cell.column.id)}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </TableCell>
    ));
  };

  return (
    <div
      className={cn(
        "border-border/50 bg-background/50 relative -mx-4 overflow-hidden rounded-lg border sm:mx-0",
        className
      )}
    >
      <TableVirtuoso
        style={{ height: `${Math.min(standings.length * 45 + 45, 600)}px` }}
        className="w-full overflow-auto"
        data={rows}
        components={TableComponents}
        fixedHeaderContent={fixedHeaderContent}
        itemContent={itemContent}
      />
      {/* Scroll indicator for mobile */}
      <div
        className="from-background/80 pointer-events-none absolute right-0 bottom-0 h-full w-8 bg-gradient-to-l to-transparent sm:hidden"
        aria-hidden="true"
      />
    </div>
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
