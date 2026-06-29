// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Building2, Handshake, Scale, Globe } from "lucide-react";
import { api } from "~/trpc/react";
import { DiplomaticRelationsList } from "./DiplomaticRelationsList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { CommandPanel } from "~/components/executive/CommandPanel";
import { CommandPanelItem } from "~/components/executive/CommandPanelItem";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import { getStrengthLabel } from "~/lib/statecraft-diplo-intel";

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
const EmbassyDetailSheet = dynamic(
  () => import("./EmbassyDetailSheet").then((m) => ({ default: m.EmbassyDetailSheet })),
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

// Full, human-readable labels for the relation + foreign-policy subtitles
// (e.g. "free_trade" → "Free Trade Agreement", not "free trade").
const ACTION_TYPE_LABELS: Record<string, string> = {
  free_trade: "Free Trade Agreement",
  military_alliance: "Military Alliance",
  non_aggression: "Non-Aggression Pact",
  cultural_exchange: "Cultural Exchange",
  embargo: "Embargo",
  sanction: "Sanctions",
  blockade: "Blockade",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  alliance: "Alliance",
  ally: "Alliance",
  allied: "Alliance",
  trade: "Trade Partner",
  trade_partner: "Trade Partner",
  economic: "Economic Partnership",
  friendly: "Friendly",
  neutral: "Neutral",
  tension: "Tension",
  rival: "Rivalry",
  rivalry: "Rivalry",
  hostile: "Hostile",
  war: "At War",
};

function titleCase(s?: string): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DiplomacyWarRoom({ countryId }: DiplomacyWarRoomProps) {
  const [activeSheet, setActiveSheet] = useState<SheetView>(null);
  const [embassyCreatorOpen, setEmbassyCreatorOpen] = useState(false);
  // Per-item targeting: the specific row the user clicked.
  const [selectedEmbassyId, setSelectedEmbassyId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const openSheet = (sheet: SheetView, focus: string | null = null) => {
    setFocusId(focus);
    setActiveSheet(sheet);
  };

  const { data: embassies, refetch: refetchEmbassies } =
    api.diplomaticEmbassies.getEmbassies.useQuery({ countryId }, { enabled: !!countryId });
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: foreignPolicies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
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
          onFooter={() => openSheet("embassies")}
          totalCount={embassyData.all.length}
          emptyIcon={Building2}
          emptyTitle="Build your diplomatic network"
          emptyDescription="Establish your first embassy to open relations and unlock trade, alliances, and intelligence sharing."
        >
          {embassyData.active.slice(0, 4).map((embassy: any) => (
            <CommandPanelItem
              key={embassy.id}
              accentColor="cyan"
              title={embassy.country ?? embassy.name ?? "Embassy"}
              flag={
                <UnifiedCountryFlag
                  countryName={embassy.country ?? ""}
                  flagUrl={embassy.countryFlag}
                  size="xs"
                  showTooltip={false}
                />
              }
              subtitle={`${embassy.role === "host" ? "Hosting" : "Guest"} · Level ${embassy.level ?? 1}`}
              onClick={() => setSelectedEmbassyId(embassy.id)}
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
                flag={
                  <UnifiedCountryFlag
                    countryName={embassy.country ?? ""}
                    flagUrl={embassy.countryFlag}
                    size="xs"
                    showTooltip={false}
                  />
                }
                subtitle={embassy.role === "host" ? "Hosting" : "Guest"}
                onClick={() => setSelectedEmbassyId(embassy.id)}
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
              ? [{ label: `avg ${getStrengthLabel(relationData.avgStrength).toLowerCase()}`, value: "" }]
              : []),
          ]}
          ctaLabel="Establish Embassy"
          onCta={() => setEmbassyCreatorOpen(true)}
          footerLabel="View All"
          onFooter={() => openSheet("relations")}
          totalCount={relationData.sorted.length}
          emptyIcon={Globe}
          emptyTitle="No relations yet"
          emptyDescription="Establish embassies to open formal relations with other nations and grow your influence."
        >
          {relationData.sorted.slice(0, 4).map((rel: any) => {
            const strength = rel.strength ?? 0;
            const color =
              strength >= 70 ? "green" : strength >= 40 ? "blue" : strength >= 20 ? "amber" : "red";
            const targetName = rel.targetCountryName ?? rel.targetCountry ?? "Unknown";
            return (
              <CommandPanelItem
                key={rel.id}
                accentColor={color}
                title={targetName}
                flag={
                  <UnifiedCountryFlag
                    countryName={targetName}
                    flagUrl={rel.targetCountryFlag}
                    size="xs"
                    showTooltip={false}
                  />
                }
                subtitle={
                  rel.relationship
                    ? (RELATIONSHIP_LABELS[rel.relationship] ?? titleCase(rel.relationship))
                    : "Diplomatic"
                }
                onClick={() => openSheet("relations", rel.targetCountryId ?? rel.id)}
                trailingText={getStrengthLabel(strength)}
                trailingColor={
                  strength >= 95
                    ? "text-emerald-500 font-extrabold"
                    : strength >= 80
                      ? "text-emerald-600 font-bold"
                      : strength >= 65
                        ? "text-green-600 font-medium"
                        : strength >= 50
                          ? "text-blue-500"
                          : strength >= 40
                            ? "text-slate-500"
                            : strength >= 30
                              ? "text-amber-500"
                              : strength >= 15
                                ? "text-amber-600 font-medium"
                                : strength >= 5
                                  ? "text-red-500 font-semibold"
                                  : "text-red-700 font-bold"
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
          ctaLabel="Propose Policy"
          onCta={() => openSheet("foreign-policy")}
          footerLabel="View All"
          onFooter={() => openSheet("foreign-policy")}
          totalCount={foreignPolicies?.length ?? 0}
          emptyIcon={Scale}
          emptyTitle="No foreign policy enacted"
          emptyDescription="Propose trade deals, sanctions, or alliances once you have relations to act on."
        >
          {activeFP.slice(0, 4).map((fp: any) => {
            const badge = ACTION_TYPE_BADGES[fp.actionType] ?? {
              label: fp.actionType?.toUpperCase() ?? "POLICY",
              colorClass: "bg-slate-100 text-slate-700",
            };
            const isInitiator = fp.initiatorId === countryId;
            const otherCountry = isInitiator ? fp.target : fp.initiator;
            const partnerName = otherCountry?.name ?? "Unknown";
            const partnerFlag = otherCountry?.flag ? normalizeFlagUrl(otherCountry.flag) : null;
            return (
              <CommandPanelItem
                key={fp.id}
                accentColor={
                  fp.actionType === "free_trade" || fp.actionType === "military_alliance"
                    ? "green"
                    : "red"
                }
                title={partnerName}
                flag={
                  <UnifiedCountryFlag
                    countryName={partnerName}
                    flagUrl={partnerFlag}
                    size="xs"
                    showTooltip={false}
                  />
                }
                subtitle={ACTION_TYPE_LABELS[fp.actionType] ?? titleCase(fp.actionType)}
                onClick={() => openSheet("foreign-policy", fp.id)}
                badges={[badge]}
              />
            );
          })}
        </CommandPanel>
      </div>

      {/* Drill-down Sheets */}
      <Dialog
        open={activeSheet === "embassies"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Embassies & Relations</DialogTitle>
            <DialogDescription>
              Full embassy network, alliances, and cultural exchanges
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <EmbassiesAndRelationsPanel countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "relations"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Diplomatic Relations</DialogTitle>
            <DialogDescription>Detailed list of diplomatic relationships</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <DiplomaticRelationsList countryId={countryId} focusId={focusId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "foreign-policy"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Foreign Policy</DialogTitle>
            <DialogDescription>Strategic foreign relations framework</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ForeignPolicyPanel countryId={countryId} focusId={focusId} />
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Per-item: click a specific embassy row → open its detail */}
      <EmbassyDetailSheet
        embassyId={selectedEmbassyId}
        countryId={countryId}
        onClose={() => setSelectedEmbassyId(null)}
        onEmbassyChanged={() => void refetchEmbassies()}
      />
    </>
  );
}
