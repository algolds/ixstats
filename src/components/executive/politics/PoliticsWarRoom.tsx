// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Landmark, Users, BarChart3 } from "lucide-react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { CommandPanel } from "~/components/executive/CommandPanel";
import { CommandPanelItem } from "~/components/executive/CommandPanelItem";

const LegislaturePanel = dynamic(
  () => import("./LegislaturePanel").then((m) => ({ default: m.LegislaturePanel })),
  { ssr: false }
);
const PartyManager = dynamic(
  () => import("./PartyManager").then((m) => ({ default: m.PartyManager })),
  { ssr: false }
);
const ElectionSimulator = dynamic(
  () => import("./ElectionSimulator").then((m) => ({ default: m.ElectionSimulator })),
  { ssr: false }
);

interface PoliticsWarRoomProps {
  countryId: string;
}

type SheetView = "legislature" | "parties" | "elections" | null;

const IDEOLOGY_BADGES: Record<string, { label: string; colorClass: string }> = {
  far_left: {
    label: "FAR LEFT",
    colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  },
  left: {
    label: "LEFT",
    colorClass: "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  },
  center_left: {
    label: "CTR-LEFT",
    colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  },
  center: {
    label: "CENTER",
    colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400",
  },
  center_right: {
    label: "CTR-RIGHT",
    colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
  right: {
    label: "RIGHT",
    colorClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
  },
  far_right: {
    label: "FAR RIGHT",
    colorClass: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  },
};

export function PoliticsWarRoom({ countryId }: PoliticsWarRoomProps) {
  const [activeSheet, setActiveSheet] = useState<SheetView>(null);

  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const totalSeats = legislature?.totalSeats ?? 0;
  const filledSeats =
    parliament?.partySummary?.reduce((sum: number, s: any) => sum + s.seats, 0) ?? 0;
  const seatSummary = parliament?.partySummary ?? [];

  const sortedParties = useMemo(
    () =>
      [...(parties ?? [])].sort((a: any, b: any) => (b.baseSupport ?? 0) - (a.baseSupport ?? 0)),
    [parties]
  );

  const {
    completed: completedElections,
    pending: pendingElections,
    all: allElections,
  } = useMemo(() => {
    const all = elections ?? [];
    return {
      completed: all.filter((e: any) => e.status === "COMPLETED" || e.status === "completed"),
      pending: all.filter(
        (e: any) =>
          e.status === "SCHEDULED" ||
          e.status === "scheduled" ||
          e.status === "IN_PROGRESS" ||
          e.status === "in_progress"
      ),
      all,
    };
  }, [elections]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Legislature */}
        <CommandPanel
          title="Legislature"
          icon={Landmark}
          accentColor="indigo"
          stats={[
            ...(totalSeats > 0 ? [{ label: "seats", value: totalSeats }] : []),
            ...(filledSeats > 0 ? [{ label: "filled", value: filledSeats }] : []),
          ]}
          ctaLabel="Configure"
          onCta={() => setActiveSheet("legislature")}
          footerLabel="View Details"
          onFooter={() => setActiveSheet("legislature")}
          emptyIcon={Landmark}
          emptyTitle={totalSeats === 0 ? "Establish your parliament" : "No seats assigned yet"}
          emptyDescription={
            totalSeats === 0
              ? "Configure your legislature's chambers, seat count, and electoral system to unlock elections."
              : "Hold an election to fill these seats with elected representatives."
          }
        >
          {totalSeats > 0 && seatSummary.length > 0 ? (
            <>
              {seatSummary.slice(0, 4).map((seat: any) => (
                <CommandPanelItem
                  key={seat.partyId ?? seat.partyName}
                  accentColor="indigo"
                  title={seat.partyName ?? "Unknown Party"}
                  subtitle={`${seat.seats} seat${seat.seats !== 1 ? "s" : ""}`}
                  trailingText={
                    totalSeats > 0 ? `${Math.round((seat.seats / totalSeats) * 100)}%` : undefined
                  }
                  trailingColor="text-indigo-600"
                />
              ))}
            </>
          ) : totalSeats > 0 ? (
            <CommandPanelItem
              accentColor="amber"
              title="Parliament configured"
              subtitle={`${totalSeats} seats · No elections held yet`}
              badges={[
                { label: "SETUP", colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/30" },
              ]}
            />
          ) : null}
        </CommandPanel>

        {/* Political Parties */}
        <CommandPanel
          title="Political Parties"
          icon={Users}
          accentColor="purple"
          stats={sortedParties.length > 0 ? [{ label: "active", value: sortedParties.length }] : []}
          ctaLabel="New Party"
          onCta={() => setActiveSheet("parties")}
          footerLabel="View All"
          onFooter={() => setActiveSheet("parties")}
          totalCount={sortedParties.length}
          emptyIcon={Users}
          emptyTitle="Create your first parties"
          emptyDescription="Create competing parties across the ideological spectrum to bring elections and legislative debate to life."
        >
          {sortedParties.slice(0, 4).map((party: any) => {
            const ideology = IDEOLOGY_BADGES[party.ideology] ?? {
              label: party.ideology?.toUpperCase() ?? "?",
              colorClass: "bg-slate-100 text-slate-700",
            };
            return (
              <CommandPanelItem
                key={party.id}
                accentColor="purple"
                title={party.name}
                subtitle={party.leader ? `Led by ${party.leader}` : undefined}
                badges={[ideology]}
                trailingText={`${party.baseSupport ?? 0}%`}
                trailingColor="text-purple-600"
              />
            );
          })}
        </CommandPanel>

        {/* Elections */}
        <CommandPanel
          title="Elections"
          icon={BarChart3}
          accentColor="violet"
          stats={[
            ...(completedElections.length > 0
              ? [{ label: "held", value: completedElections.length }]
              : []),
            ...(pendingElections.length > 0
              ? [{ label: "pending", value: pendingElections.length }]
              : []),
          ]}
          ctaLabel="Schedule"
          onCta={() => setActiveSheet("elections")}
          footerLabel="View All"
          onFooter={() => setActiveSheet("elections")}
          totalCount={allElections.length}
          emptyIcon={BarChart3}
          emptyTitle="No elections yet"
          emptyDescription="Schedule an election to fill your legislature once your parties are registered."
        >
          {pendingElections.slice(0, 2).map((election: any) => (
            <CommandPanelItem
              key={election.id}
              accentColor="amber"
              title={election.name ?? "Election"}
              subtitle={election.electionType ?? "general"}
              badges={[
                {
                  label: "PENDING",
                  colorClass:
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
                },
              ]}
              pulse
            />
          ))}
          {completedElections
            .slice(0, Math.max(0, 4 - pendingElections.length))
            .map((election: any) => (
              <CommandPanelItem
                key={election.id}
                accentColor="green"
                title={election.name ?? "Election"}
                subtitle={election.electionType ?? "general"}
                badges={[
                  {
                    label: "COMPLETED",
                    colorClass:
                      "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
                  },
                ]}
              />
            ))}
        </CommandPanel>
      </div>

      {/* Drill-down Sheets */}
      <Dialog
        open={activeSheet === "legislature"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Legislature</DialogTitle>
            <DialogDescription>
              Configure parliament, political metrics, and governance
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <LegislaturePanel countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "parties"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Political Parties</DialogTitle>
            <DialogDescription>Manage parties, ideologies, and support bases</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <PartyManager countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "elections"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Elections</DialogTitle>
            <DialogDescription>
              Schedule elections, register candidates, and view results
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ElectionSimulator countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
