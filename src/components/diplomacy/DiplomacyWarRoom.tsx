"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Building2, Handshake, Scale, Globe } from "lucide-react";
import { api } from "~/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { CommandPanel } from "~/components/executive/CommandPanel";
import { CommandPanelItem } from "~/components/executive/CommandPanelItem";

const DiplomacyOverview = dynamic(
  () => import("./DiplomacyOverview").then((m) => ({ default: m.DiplomacyOverview })),
  { ssr: false }
);
const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("./EmbassiesAndRelationsPanel").then((m) => ({ default: m.EmbassiesAndRelationsPanel })),
  { ssr: false }
);
const ForeignPolicyPanel = dynamic(
  () => import("./ForeignPolicyPanel").then((m) => ({ default: m.ForeignPolicyPanel })),
  { ssr: false }
);
const EmbassyCreatorSheet = dynamic(
  () => import("./EmbassyCreatorSheet").then((m) => ({ default: m.EmbassyCreatorSheet })),
  { ssr: false }
);

interface DiplomacyWarRoomProps {
  countryId: string;
}

type SheetView = "embassies" | "relations" | "foreign-policy" | null;

const ACTION_TYPE_BADGES: Record<string, { label: string; colorClass: string }> = {
  embargo: {
    label: "EMBARGO",
    colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  },
  sanction: {
    label: "SANCTION",
    colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  },
  blockade: {
    label: "BLOCKADE",
    colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  },
  free_trade: {
    label: "TRADE",
    colorClass: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  },
  military_alliance: {
    label: "ALLIANCE",
    colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
};

export function DiplomacyWarRoom({ countryId }: DiplomacyWarRoomProps) {
  const [activeSheet, setActiveSheet] = useState<SheetView>(null);
  const [embassyCreatorOpen, setEmbassyCreatorOpen] = useState(false);

  const { data: embassies, refetch: refetchEmbassies } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: relations } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: foreignPolicies } = api.diplomatic.getActiveForeignPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const embassyData = useMemo(() => {
    const active =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active") ?? [];
    const pending =
      embassies?.filter((e: any) => e.status === "PENDING" || e.status === "pending") ?? [];
    return { active, pending, all: embassies ?? [] };
  }, [embassies]);

  const relationData = useMemo(() => {
    const sorted = [...(relations ?? [])].sort(
      (a: any, b: any) => (b.strength ?? 0) - (a.strength ?? 0)
    );
    const avgStrength =
      sorted.length > 0
        ? Math.round(
            sorted.reduce((sum: number, r: any) => sum + (r.strength ?? 0), 0) / sorted.length
          )
        : 0;
    return { sorted, avgStrength };
  }, [relations]);

  const activeFP = foreignPolicies?.filter((fp: any) => fp.status === "active") ?? [];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Embassy Network */}
        <CommandPanel
          title="Embassy Network"
          icon={Building2}
          accentColor="cyan"
          stats={[
            { label: "active", value: embassyData.active.length },
            ...(embassyData.pending.length > 0
              ? [{ label: "pending", value: embassyData.pending.length }]
              : []),
          ]}
          ctaLabel="Establish"
          onCta={() => setEmbassyCreatorOpen(true)}
          footerLabel="View All"
          onFooter={() => setActiveSheet("embassies")}
          totalCount={embassyData.all.length}
          emptyIcon={Building2}
          emptyMessage="No embassies established"
        >
          {embassyData.active.slice(0, 4).map((embassy: any) => (
            <CommandPanelItem
              key={embassy.id}
              accentColor="cyan"
              title={embassy.country ?? embassy.name ?? "Embassy"}
              subtitle={`${embassy.role === "host" ? "Hosting" : "Guest"} · Level ${embassy.level ?? 1}`}
              badges={[
                {
                  label: "ACTIVE",
                  colorClass:
                    "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
                },
              ]}
            />
          ))}
          {embassyData.pending
            .slice(0, Math.max(0, 4 - embassyData.active.length))
            .map((embassy: any) => (
              <CommandPanelItem
                key={embassy.id}
                accentColor="amber"
                title={embassy.country ?? embassy.name ?? "Embassy"}
                subtitle={embassy.role === "host" ? "Hosting" : "Guest"}
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
        </CommandPanel>

        {/* Relations */}
        <CommandPanel
          title="Relations"
          icon={Handshake}
          accentColor="blue"
          stats={[
            { label: "nations", value: relationData.sorted.length },
            ...(relationData.avgStrength > 0
              ? [{ label: `avg ${relationData.avgStrength}%`, value: "" }]
              : []),
          ]}
          footerLabel="View All"
          onFooter={() => setActiveSheet("relations")}
          totalCount={relationData.sorted.length}
          emptyIcon={Globe}
          emptyMessage="No diplomatic relations"
        >
          {relationData.sorted.slice(0, 4).map((rel: any) => {
            const strength = rel.strength ?? 0;
            const color =
              strength >= 70 ? "green" : strength >= 40 ? "blue" : strength >= 20 ? "amber" : "red";
            return (
              <CommandPanelItem
                key={rel.id}
                accentColor={color}
                title={rel.targetCountry?.name ?? rel.countryB?.name ?? "Unknown"}
                subtitle={rel.relationType ?? "diplomatic"}
                trailingText={`${strength}%`}
                trailingColor={
                  strength >= 70
                    ? "text-green-600"
                    : strength >= 40
                      ? "text-blue-600"
                      : "text-amber-600"
                }
              />
            );
          })}
        </CommandPanel>

        {/* Foreign Policy */}
        <CommandPanel
          title="Foreign Policy"
          icon={Scale}
          accentColor="indigo"
          stats={activeFP.length > 0 ? [{ label: "active", value: activeFP.length }] : []}
          footerLabel="View All"
          onFooter={() => setActiveSheet("foreign-policy")}
          totalCount={foreignPolicies?.length ?? 0}
          emptyIcon={Scale}
          emptyMessage="No active foreign policies"
        >
          {activeFP.slice(0, 4).map((fp: any) => {
            const badge = ACTION_TYPE_BADGES[fp.actionType] ?? {
              label: fp.actionType?.toUpperCase() ?? "POLICY",
              colorClass: "bg-slate-100 text-slate-700",
            };
            const targetName = fp.target?.name ?? "Unknown";
            return (
              <CommandPanelItem
                key={fp.id}
                accentColor={
                  fp.actionType === "free_trade" || fp.actionType === "military_alliance"
                    ? "green"
                    : "red"
                }
                title={targetName}
                subtitle={fp.actionType?.replace(/_/g, " ")}
                badges={[badge]}
              />
            );
          })}
        </CommandPanel>
      </div>

      {/* Drill-down Sheets */}
      <Sheet
        open={activeSheet === "embassies"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Embassies & Relations</SheetTitle>
            <SheetDescription>
              Full embassy network, alliances, and cultural exchanges
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <EmbassiesAndRelationsPanel countryId={countryId} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "relations"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Diplomatic Relations</SheetTitle>
            <SheetDescription>Overview of all diplomatic relationships</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <DiplomacyOverview countryId={countryId} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "foreign-policy"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Foreign Policy</SheetTitle>
            <SheetDescription>Strategic foreign relations framework</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <ForeignPolicyPanel countryId={countryId} />
          </div>
        </SheetContent>
      </Sheet>

      {typeof EmbassyCreatorSheet !== "undefined" && (
        <EmbassyCreatorSheet
          countryId={countryId}
          open={embassyCreatorOpen}
          onOpenChange={(open: boolean) => {
            setEmbassyCreatorOpen(open);
            if (!open) void refetchEmbassies();
          }}
        />
      )}
    </>
  );
}
