// @ts-nocheck
"use client";

import { useMemo } from "react";
import { Vote, Landmark, Scale, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { TabHeroBanner } from "~/components/mycountry/primitives/TabHeroBanner";
import { ParliamentHemicycle } from "./ParliamentHemicycle";

// ── Type shapes inferred from tRPC query returns ──────────────────────────

interface Party {
  id: string;
  name: string;
  shortName?: string | null;
  ideology: string;
  color: string;
  currentSupport: number;
  isActive: boolean;
}

interface LegislatureData {
  id: string;
  name: string;
  chamberType: string;
  totalSeats: number;
  electoralSystem: string;
  termLength: number;
}

interface ParliamentSeat {
  seatNumber: number;
  partyId: string | null;
  partyColor: string;
  partyName: string;
}

interface Parliament {
  legislature?: LegislatureData;
  seats: ParliamentSeat[];
  partySummary: Array<{
    party: { id: string; name: string; shortName: string | null; color: string; ideology: string };
    seats: number;
  }>;
}

interface ElectionCandidate {
  id: string;
  partyId: string;
  candidateName: string;
  party: { id: string; name: string; shortName?: string | null; color: string };
}

interface ElectionResult {
  candidateId: string;
  votePercentage: number;
  seatsWon: number;
  votesReceived: number;
}

interface Election {
  id: string;
  name: string;
  electionType: string;
  status: string;
  scheduledIxTime: number;
  turnout?: number | null;
  marginOfVictory?: number | null;
  candidates: ElectionCandidate[];
  results: ElectionResult[];
}

interface PoliticsOverviewProps {
  country: { id: string; name: string; governmentType?: string | null };
  parties: Party[] | undefined;
  legislature: LegislatureData | null | undefined;
  parliament: Parliament | null | undefined;
  elections: Election[] | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const IDEOLOGY_META: Record<string, { label: string; color: string; bg: string }> = {
  far_left: {
    label: "Far Left",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950/40",
  },
  left: {
    label: "Left",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950/40",
  },
  center_left: {
    label: "Centre-Left",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/40",
  },
  center: {
    label: "Centre",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/40",
  },
  center_right: {
    label: "Centre-Right",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/40",
  },
  right: {
    label: "Right",
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-100 dark:bg-indigo-950/40",
  },
  far_right: {
    label: "Far Right",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-950/40",
  },
};

const ELECTORAL_LABELS: Record<string, string> = {
  proportional: "Proportional (D'Hondt)",
  fptp: "First Past the Post",
  mixed: "Mixed System",
};

const CHAMBER_LABELS: Record<string, string> = {
  unicameral: "Unicameral",
  bicameral: "Bicameral",
};

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  special: "By-Election",
  referendum: "Referendum",
};

// ── Sub-components ────────────────────────────────────────────────────────

function SystemChip({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="glass-hierarchy-child border-border rounded-lg border p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-indigo-500" />
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {label}
        </span>
      </div>
      <p className={`truncate text-sm font-semibold ${muted ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function PartyRow({
  party,
  totalSeats,
  seats,
  showSeats,
}: {
  party: { id: string; name: string; shortName?: string | null; color: string; ideology?: string };
  totalSeats: number;
  seats?: number;
  showSeats?: boolean;
}) {
  const ideologyKey = party.ideology ?? "";
  const meta = IDEOLOGY_META[ideologyKey];
  const pct =
    showSeats && totalSeats > 0 && seats !== undefined ? (seats / totalSeats) * 100 : undefined;

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: party.color }} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {party.shortName ?? party.name}
      </span>
      {meta && (
        <span
          className={`hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex ${meta.bg} ${meta.color}`}
        >
          {meta.label}
        </span>
      )}
      {pct !== undefined ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: party.color }}
            />
          </div>
          <span className="text-muted-foreground w-8 text-right text-xs">{seats}</span>
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function PoliticsOverview({
  country,
  parties,
  legislature,
  parliament,
  elections,
}: PoliticsOverviewProps) {
  const activeSortedParties = useMemo(
    () =>
      (parties ?? []).filter((p) => p.isActive).sort((a, b) => b.currentSupport - a.currentSupport),
    [parties]
  );

  const mostRecentElection = useMemo(() => {
    const completed = (elections ?? []).filter(
      (e) => e.status === "completed" || e.status === "COMPLETED"
    );
    if (completed.length === 0) return null;
    return completed.reduce((a, b) => (b.scheduledIxTime > a.scheduledIxTime ? b : a));
  }, [elections]);

  const electionWinner = useMemo(() => {
    if (!mostRecentElection) return null;
    const topResult = [...(mostRecentElection.results ?? [])].sort(
      (a, b) => b.seatsWon - a.seatsWon || b.votePercentage - a.votePercentage
    )[0];
    if (!topResult) return null;
    const candidate = mostRecentElection.candidates.find((c) => c.id === topResult.candidateId);
    return { candidate, result: topResult };
  }, [mostRecentElection]);

  const hemicycleSeats = parliament?.seats ?? [];
  const partySummary = parliament?.partySummary ?? [];
  const totalSeats = legislature?.totalSeats ?? 0;

  const visibleParties = activeSortedParties.slice(0, 6);
  const extraParties = activeSortedParties.length - 6;
  const visiblePartySummary = partySummary.slice(0, 6);
  const extraSummary = partySummary.length - 6;

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="politics_overview"
        as
        any
        title="Political Overview"
        subtitle="Government system, parliament, and party landscape"
        icon={Vote}
        accentColor="indigo"
      />

      {/* ── Political System Strip ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SystemChip
          icon={Vote}
          label="System"
          value={country.governmentType ?? "—"}
          muted={!country.governmentType}
        />
        <SystemChip
          icon={Landmark}
          label="Legislature"
          value={
            legislature
              ? `${legislature.name} (${CHAMBER_LABELS[legislature.chamberType] ?? legislature.chamberType})`
              : "Not configured"
          }
          muted={!legislature}
        />
        <SystemChip
          icon={Scale}
          label="Electoral System"
          value={
            legislature
              ? (ELECTORAL_LABELS[legislature.electoralSystem] ?? legislature.electoralSystem)
              : "—"
          }
          muted={!legislature}
        />
        <SystemChip
          icon={Calendar}
          label="Term Length"
          value={legislature ? `${legislature.termLength} years` : "—"}
          muted={!legislature}
        />
      </div>

      {/* ── Parliament + Party Standings ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Parliament Composition */}
        <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold">Parliament Composition</h3>
            {totalSeats > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px]">
                {totalSeats} seats
              </Badge>
            )}
          </div>

          {hemicycleSeats.length > 0 && totalSeats > 0 ? (
            <>
              <ParliamentHemicycle
                seats={hemicycleSeats}
                totalSeats={totalSeats}
                partySummary={partySummary}
                legislatureName={legislature?.name}
              />
              {visiblePartySummary.length > 0 && (
                <div className="border-border space-y-0.5 border-t pt-2">
                  {visiblePartySummary.map((ps) => (
                    <PartyRow
                      key={ps.party.id}
                      party={ps.party}
                      totalSeats={totalSeats}
                      seats={ps.seats}
                      showSeats
                    />
                  ))}
                  {extraSummary > 0 && (
                    <p className="text-muted-foreground pt-1 text-xs">
                      + {extraSummary} more parties
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Landmark className="h-8 w-8 opacity-30" />
              <p className="text-sm">Parliament not configured</p>
              <p className="text-xs">
                Set up your legislature and run an election to see composition here.
              </p>
            </div>
          )}
        </div>

        {/* Party Standings */}
        <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold">Party Standings</h3>
            {activeSortedParties.length > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px]">
                {activeSortedParties.length} active
              </Badge>
            )}
          </div>

          {visibleParties.length > 0 ? (
            <div className="space-y-1">
              {visibleParties.map((party) => {
                const meta = IDEOLOGY_META[party.ideology];
                return (
                  <div key={party.id} className="flex items-center gap-2 py-1">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: party.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {party.name}
                    </span>
                    {meta && (
                      <span
                        className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex ${meta.bg} ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    )}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(party.currentSupport, 100)}%`,
                            backgroundColor: party.color,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground w-9 text-right text-xs">
                        {party.currentSupport.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {extraParties > 0 && (
                <p className="text-muted-foreground pt-1 text-xs">+ {extraParties} more parties</p>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <p className="text-sm">No parties registered</p>
              <p className="text-xs">Register political parties in the Parties tab.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Most Recent Election ── */}
      <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold">Most Recent Election</h3>
          {mostRecentElection && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              {TYPE_LABELS[mostRecentElection.electionType] ?? mostRecentElection.electionType}
            </Badge>
          )}
        </div>

        {mostRecentElection && electionWinner ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm font-medium">{mostRecentElection.name}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Winner */}
              <div className="bg-muted/40 col-span-2 flex items-center gap-2.5 rounded-lg p-3">
                <div
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: electionWinner.candidate?.party.color ?? "#6366f1" }}
                />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    Winner
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {electionWinner.candidate?.party.name ?? "Unknown"}
                  </p>
                </div>
              </div>
              {/* Seats */}
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Seats Won
                </p>
                <p className="text-foreground text-lg font-bold">
                  {electionWinner.result.seatsWon}
                </p>
                <p className="text-muted-foreground text-[10px]">
                  {totalSeats > 0 ? `of ${totalSeats}` : "seats"}
                </p>
              </div>
              {/* Vote % */}
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Vote Share
                </p>
                <p className="text-foreground text-lg font-bold">
                  {electionWinner.result.votePercentage.toFixed(1)}%
                </p>
                {mostRecentElection.turnout != null && (
                  <p className="text-muted-foreground text-[10px]">
                    {mostRecentElection.turnout.toFixed(0)}% turnout
                  </p>
                )}
              </div>
            </div>
            {mostRecentElection.marginOfVictory != null && (
              <p className="text-muted-foreground text-xs">
                Margin of victory:{" "}
                <span className="font-medium">
                  {mostRecentElection.marginOfVictory.toFixed(1)}%
                </span>
                {mostRecentElection.marginOfVictory < 2 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">— Very close race</span>
                )}
                {mostRecentElection.marginOfVictory > 15 && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    — Decisive victory
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Vote className="h-8 w-8 opacity-30" />
            <p className="text-sm">No elections held yet</p>
            <p className="text-xs">Schedule and simulate an election in the Elections tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
