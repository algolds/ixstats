"use client";

import React, { useMemo } from "react";
import {
  City as Building2,
  Group as Users,
  Bank as Landmark,
  CheckCircle,
  StatsReport as BarChart3,
  CheckSquare as Vote,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { computeApproval } from "~/lib/government/approval";
import { ParliamentHemicycle } from "~/components/executive/politics/ParliamentHemicycle";
import {
  DomainKpiGrid,
  DomainActivityCard,
  type Kpi,
  type ActivityEntry,
} from "./shared";

interface PartyItem {
  id: string;
  name: string;
  ideology?: string | null;
  currentSupport?: number | null;
  popularSupport?: number | null;
  seatsOwned?: number | null;
  seats?: number | null;
  createdAt?: string | Date | null;
}

interface ElectionItem {
  id: string;
  name?: string | null;
  status?: string | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface LegislatureItem {
  totalSeats: number;
  name?: string | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface ParliamentSeatItem {
  seatNumber: number;
  partyColor: string;
  partyName: string;
  partyId?: string | null;
  chamber?: string;
}

interface ParliamentPartySummaryItem {
  party: {
    id: string;
    name: string;
    shortName: string | null;
    color: string;
    ideology?: string;
  };
  seats: number;
}

interface ParliamentData {
  legislature: {
    id?: string;
    name?: string | null;
    chamberType?: string;
    totalSeats: number;
    termLength?: number | null;
  } | null;
  seats: ParliamentSeatItem[];
  partySummary: ParliamentPartySummaryItem[];
}

/** Politics rail — parties / seats / approval snapshot + recent political activity. */
export function PoliticsRail({ countryId }: { countryId: string }) {
  const { data: partiesRaw } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: electionsRaw } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: legislatureRaw } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parliamentRaw } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const parties = partiesRaw as PartyItem[] | undefined;
  const elections = electionsRaw as ElectionItem[] | undefined;
  const legislature = legislatureRaw as LegislatureItem | undefined;
  const parliament = parliamentRaw as ParliamentData | null | undefined;

  const kpis = useMemo<Kpi[]>(() => {
    const approval = computeApproval(
      (parties ?? []).map((p) => ({ id: p.id, currentSupport: p.currentSupport ?? 0 })),
      null
    );
    return [
      { label: "Parties", value: parties?.length ?? 0 },
      { label: "Seats", value: legislature?.totalSeats ?? 0 },
      { label: "Approval", value: `${approval}%` },
    ];
  }, [parties, legislature]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    if (legislature && legislature.totalSeats > 0) {
      entries.push({
        id: "legislature",
        icon: Landmark,
        iconColor: "text-indigo-500",
        text: `Legislature: ${legislature.totalSeats} seats configured`,
        time: new Date(
          legislature.updatedAt ?? legislature.createdAt ?? Date.now()
        ),
      });
    }

    parties?.forEach((p) => {
      entries.push({
        id: `party-${p.id}`,
        icon: Users,
        iconColor: "text-indigo-500",
        text: `Party: ${p.name} (${p.ideology?.replace(/_/g, " ") ?? "Independent"})`,
        time: new Date(p.createdAt ?? Date.now()),
      });
    });

    elections?.forEach((e) => {
      const isCompleted = e.status === "COMPLETED" || e.status === "completed";
      entries.push({
        id: `election-${e.id}`,
        icon: isCompleted ? CheckCircle : BarChart3,
        iconColor: isCompleted ? "text-emerald-500" : "text-indigo-500",
        text: isCompleted
          ? `Completed: ${e.name ?? "Election"}`
          : `Scheduled: ${e.name ?? "Election"}`,
        time: new Date(e.updatedAt ?? e.createdAt ?? Date.now()),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [parties, elections, legislature]);

  const hasParliamentSeats = parliament?.seats && parliament.seats.length > 0;

  return (
    <div className="space-y-4">
      {/* Political Snapshot Header KPIs */}
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-3.5 w-3.5 text-indigo-500" />
            <h4 className="text-xs font-bold tracking-widest text-indigo-500 uppercase">
              Political Snapshot
            </h4>
          </div>
        </div>
        <DomainKpiGrid items={kpis} />
      </FacetCard>

      {/* Parliament Seat Allocation Card (Hemicycle Arc & Seat Breakdown) */}
      <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            <h4 className="text-foreground truncate text-xs font-bold">
              {parliament?.legislature?.name
                ? `${parliament.legislature.name} Seat Allocation`
                : "Legislature Seat Allocation"}
            </h4>
          </div>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-extrabold text-indigo-500">
            {parliament?.legislature?.totalSeats ?? legislature?.totalSeats ?? 0} Seats
          </span>
        </div>

        {hasParliamentSeats && parliament?.legislature ? (
          <div className="flex flex-col items-center overflow-hidden">
            <ParliamentHemicycle
              seats={parliament.seats}
              totalSeats={parliament.legislature.totalSeats}
              partySummary={parliament.partySummary}
              legislatureName={parliament.legislature.name ?? undefined}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground py-1 text-center font-mono text-[10px]">
              Chamber Hemicycle ({legislature?.totalSeats ?? 100} Total Seats)
            </p>
            {parties && parties.length > 0 ? (
              <div className="space-y-1.5">
                {parties.slice(0, 4).map((p) => {
                  const seats = p.seatsOwned ?? p.seats ?? 0;
                  const total = legislature?.totalSeats ?? 100;
                  const pct = total > 0 ? (seats / total) * 100 : 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate text-[11px] font-semibold">
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-indigo-500">
                        {seats} seats ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground py-2 text-center text-[11px]">
                No legislature seats allocated yet.
              </p>
            )}
          </div>
        )}
      </FacetCard>

      {/* Political Parties & Factions Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-indigo-500" />
            <h4 className="text-foreground text-xs font-bold">Political Parties</h4>
          </div>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-extrabold text-indigo-500">
            {parties?.length ?? 0} Parties
          </span>
        </div>

        <div className="space-y-1.5">
          {!parties || parties.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              No registered political parties.
            </p>
          ) : (
            parties.slice(0, 4).map((party) => {
              const support = party.currentSupport ?? party.popularSupport ?? 0;
              const seats = party.seatsOwned ?? party.seats ?? 0;

              return (
                <div
                  key={party.id}
                  className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex min-w-0 items-center gap-1.5 pr-2">
                      <span className="text-foreground truncate font-semibold">{party.name}</span>
                      <span className="text-muted-foreground font-mono text-[9px] uppercase">
                        ({party.ideology?.replace(/_/g, " ") ?? "Centrist"})
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-indigo-500">
                      {support}% support · {seats} seats
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, support))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </FacetCard>

      {/* Political Activity Feed */}
      <DomainActivityCard
        domain="politics"
        title="Political Log"
        icon={Vote}
        entries={activity}
        emptyMessage="No political activity yet"
      />
    </div>
  );
}
