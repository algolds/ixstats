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
import { api } from "~/trpc/react";
import { computeApproval } from "~/lib/government/approval";
import { ParliamentHemicycle } from "~/components/executive/politics/ParliamentHemicycle";
import {
  DomainKpiGrid,
  DomainActivityCard,
  RailBar,
  RailCard,
  RailCount,
  RailEmpty,
  RailRow,
  STATUS_TEXT,
  type Kpi,
  type ActivityEntry,
} from "./shared";

interface PartyItem {
  id: string;
  name: string;
  ideology?: string | null;
  currentSupport?: number | null;
  popularSupport?: number | null;
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
        iconColor: STATUS_TEXT.neutral,
        text: `Legislature: ${legislature.totalSeats} seats configured`,
        time: new Date(legislature.updatedAt ?? legislature.createdAt ?? Date.now()),
      });
    }

    parties?.forEach((p) => {
      entries.push({
        id: `party-${p.id}`,
        icon: Users,
        iconColor: STATUS_TEXT.neutral,
        text: `Party: ${p.name} (${p.ideology?.replace(/_/g, " ") ?? "Independent"})`,
        time: new Date(p.createdAt ?? Date.now()),
      });
    });

    elections?.forEach((e) => {
      const isCompleted = e.status === "COMPLETED" || e.status === "completed";
      entries.push({
        id: `election-${e.id}`,
        icon: isCompleted ? CheckCircle : BarChart3,
        iconColor: isCompleted ? STATUS_TEXT.success : STATUS_TEXT.neutral,
        text: isCompleted
          ? `Completed: ${e.name ?? "Election"}`
          : `Scheduled: ${e.name ?? "Election"}`,
        time: new Date(e.updatedAt ?? e.createdAt ?? Date.now()),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [parties, elections, legislature]);

  const hasParliamentSeats = parliament?.seats && parliament.seats.length > 0;

  // Seats a party actually holds in the chamber (from LegislativeSeat rows; 0 until elected).
  const seatsByParty = useMemo(
    () => new Map((parliament?.partySummary ?? []).map((ps) => [ps.party.id, ps.seats])),
    [parliament]
  );

  return (
    <div className="space-y-6">
      {/* Political snapshot KPIs */}
      <RailCard title="Political snapshot" icon={Landmark}>
        <DomainKpiGrid items={kpis} />
      </RailCard>

      {/* Parliament seat allocation (hemicycle arc and seat breakdown) */}
      <RailCard
        title={
          parliament?.legislature?.name
            ? `${parliament.legislature.name} seat allocation`
            : "Legislature seat allocation"
        }
        icon={Building2}
        accessory={
          <RailCount>
            {parliament?.legislature?.totalSeats ?? legislature?.totalSeats ?? 0} seats
          </RailCount>
        }
      >
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
            <p className="text-label-secondary text-footnote py-1 text-center">
              Chamber hemicycle ({legislature?.totalSeats ?? 100} total seats)
            </p>
            {parties && parties.length > 0 ? (
              <div className="space-y-2">
                {parties.slice(0, 4).map((p) => {
                  const seats = seatsByParty.get(p.id) ?? 0;
                  const total = legislature?.totalSeats ?? 100;
                  const pct = total > 0 ? (seats / total) * 100 : 0;
                  return (
                    <div
                      key={p.id}
                      className="text-footnote flex items-center justify-between gap-2"
                    >
                      <span className="text-label truncate font-medium">{p.name}</span>
                      <span className="text-label-secondary shrink-0 tabular-nums">
                        {seats} seats ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <RailEmpty>No legislature seats allocated yet.</RailEmpty>
            )}
          </div>
        )}
      </RailCard>

      {/* Political parties snapshot */}
      <RailCard
        title="Political parties"
        icon={Users}
        accessory={<RailCount>{parties?.length ?? 0}</RailCount>}
      >
        {!parties || parties.length === 0 ? (
          <RailEmpty>No registered political parties.</RailEmpty>
        ) : (
          parties.slice(0, 4).map((party) => {
            const support = party.currentSupport ?? party.popularSupport ?? 0;
            const seats = seatsByParty.get(party.id) ?? 0;

            return (
              <RailRow key={party.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="text-label truncate font-medium">{party.name}</span>
                    <span className="text-label-secondary shrink-0 truncate capitalize">
                      {party.ideology?.replace(/_/g, " ") ?? "centrist"}
                    </span>
                  </div>
                  <span className="text-label shrink-0 tabular-nums">
                    {support}% · {seats} seats
                  </span>
                </div>
                <RailBar value={support} />
              </RailRow>
            );
          })
        )}
      </RailCard>

      {/* Political activity feed */}
      <DomainActivityCard
        domain="politics"
        title="Political log"
        icon={Vote}
        entries={activity}
        emptyMessage="No political activity yet"
      />
    </div>
  );
}
