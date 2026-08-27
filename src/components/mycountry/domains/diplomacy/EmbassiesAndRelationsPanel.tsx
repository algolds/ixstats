"use client";

import { useState, useMemo } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  City as Building2,
  Group as Users,
  Community as Handshake,
  Page as FileText,
  Palette,
  Plus,
  NavArrowRight as ChevronRight,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";

// Hooks
import { useEmbassyNetworkData } from "~/hooks/useEmbassyNetworkData";
import { useNetworkMetrics } from "~/hooks/useNetworkMetrics";

// Sub-components (embassy network)
import { EmbassyGrid, EmptyState } from "./embassy-network";
import { SharedDataModal } from "./SharedDataModal";
import { DiplomaticRelationsList } from "./DiplomaticRelationsList";

// Alliance sub-component
import { AllianceDashboard } from "./alliances/AllianceDashboard";

// Cultural exchanges
import { CulturalExchangeProgram } from "./CulturalExchangeProgram";

// Diplomatic events
import { DiplomaticEventsHub } from "./DiplomaticEventsHub";

// Sheets
import { EmbassyCreatorSheet } from "./EmbassyCreatorSheet";
import { EmbassyDetailSheet } from "./EmbassyDetailSheet";
import { AllianceCreatorSheet } from "./AllianceCreatorSheet";

interface EmbassiesAndRelationsPanelProps {
  countryId: string;
}

export function EmbassiesAndRelationsPanel({ countryId }: EmbassiesAndRelationsPanelProps) {
  const { user } = useUser();

  // Sheet state
  const [showEmbassyCreator, setShowEmbassyCreator] = useState(false);
  const [selectedEmbassyId, setSelectedEmbassyId] = useState<string | null>(null);
  const [showAllianceCreator, setShowAllianceCreator] = useState(false);

  // Sub-tab navigation state
  const [activeTab, setActiveTab] = useState<
    "embassies" | "relations" | "alliances" | "exchanges" | "events"
  >("embassies");

  // Collapsible sections
  // oxlint-disable-next-line eslint/no-unused-vars
  const [relationsExpanded, setRelationsExpanded] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const [exchangesExpanded, setExchangesExpanded] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const [eventsExpanded, setEventsExpanded] = useState(false);

  // Determine ownership
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const isOwner = userProfile?.countryId === countryId;

  // Country data
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // Embassy data (with synergies)
  const {
    embassiesWithSynergies,
    isLoading: embassiesLoading,
    refetch: refetchEmbassies,
  } = useEmbassyNetworkData(countryId, isOwner);
  // oxlint-disable-next-line eslint/no-unused-vars
  const networkMetrics = useNetworkMetrics(embassiesWithSynergies);

  // Shared data modal (embassy synergy detail — legacy)
  const [showSharedData, setShowSharedData] = useState<string | null>(null);
  const closeSharedDataModal = () => setShowSharedData(null);

  // Relations data
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Alliances data
  const { data: alliances, refetch: refetchAlliances } =
    api.diplomaticPolicies.getAlliances.useQuery({ countryId }, { enabled: !!countryId });

  // Stats
  const stats = useMemo(() => {
    const activeEmbassies = embassiesWithSynergies.filter(
      (e) => e.status === "ACTIVE" || e.status === "active"
    ).length;

    const relationsTargetIds = new Set(relations?.map((r: any) => r.targetCountryId) ?? []);
    let additionalRelationsCount = 0;
    embassiesWithSynergies.forEach((e: any) => {
      if (e.status === "ACTIVE" || e.status === "active") {
        const partnerId = e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId;
        if (!relationsTargetIds.has(partnerId)) {
          additionalRelationsCount++;
          relationsTargetIds.add(partnerId);
        }
      }
    });

    const relList = relations ?? [];
    const totalRelations = relList.length + additionalRelationsCount;
    const allianceCount = alliances?.length ?? 0;
    const avgStrength =
      totalRelations > 0
        ? Math.round(relList.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
        : 0;

    return { activeEmbassies, totalRelations, allianceCount, avgStrength };
  }, [embassiesWithSynergies, relations, alliances, countryId]);

  const countryName = country?.name ?? "Your Country";

  if (embassiesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Sub-Tab Navigation Bar ─── */}
      <div className="border-border/30 flex scrollbar-none items-center gap-1.5 overflow-x-auto border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("embassies")}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95",
            activeTab === "embassies"
              ? "border border-amber-500/40 bg-amber-500/20 text-amber-500 shadow-sm"
              : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
          )}
        >
          <Building2 className="h-4 w-4" />
          <span>Embassy Network</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[9px]">
            {stats.activeEmbassies}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("relations")}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95",
            activeTab === "relations"
              ? "border border-blue-500/40 bg-blue-500/20 text-blue-400 shadow-sm"
              : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
          )}
        >
          <Handshake className="h-4 w-4" />
          <span>Bilateral Relations</span>
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-mono text-[9px]">
            {stats.totalRelations}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alliances")}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95",
            activeTab === "alliances"
              ? "border border-purple-500/40 bg-purple-500/20 text-purple-400 shadow-sm"
              : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
          )}
        >
          <Users className="h-4 w-4" />
          <span>Alliances & Blocs</span>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 font-mono text-[9px]">
            {stats.allianceCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("exchanges")}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95",
            activeTab === "exchanges"
              ? "border border-pink-500/40 bg-pink-500/20 text-pink-400 shadow-sm"
              : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
          )}
        >
          <Palette className="h-4 w-4" />
          <span>Cultural Exchanges</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95",
            activeTab === "events"
              ? "border border-amber-500/40 bg-amber-500/20 text-amber-400 shadow-sm"
              : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
          )}
        >
          <FileText className="h-4 w-4" />
          <span>Diplomatic Events</span>
        </button>
      </div>

      {/* ─── Tab Content Views ─── */}
      {activeTab === "embassies" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cyan-500" />
              <h3 className="text-sm font-semibold">Embassy Network</h3>
              <SectionHelpIcon
                title="Embassy Network"
                content="Manage your diplomatic embassies. Embassies provide synergy bonuses based on shared government components and improve bilateral relations with host nations."
              />
            </div>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowEmbassyCreator(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Establish Embassy
              </Button>
            )}
          </div>

          {/* Embassy grid or empty state */}
          {embassiesWithSynergies.length > 0 ? (
            <EmbassyGrid
              embassies={embassiesWithSynergies}
              isOwner={isOwner}
              onEmbassyClick={(id) => setSelectedEmbassyId(id)}
            />
          ) : (
            <EmptyState isOwner={isOwner} onEstablishEmbassy={() => setShowEmbassyCreator(true)} />
          )}
        </section>
      )}

      {activeTab === "relations" && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">Diplomatic Relations</h3>
          </div>
          <DiplomaticRelationsList countryId={countryId} />
        </section>
      )}

      {activeTab === "alliances" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-semibold">Alliances & Blocs</h3>
              <SectionHelpIcon
                title="Alliances & Blocs"
                content="Form and manage alliances with other nations. Alliances provide mutual defense benefits, trade advantages, and diplomatic leverage."
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAllianceCreator(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Alliance
            </Button>
          </div>

          {!alliances || alliances.length === 0 ? (
            <div className="border-border rounded-lg border border-dashed p-6 text-center">
              <Users className="text-muted-foreground/40 mx-auto mb-3 h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                Not a member of any alliances. Create one or wait for an invitation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alliances.map((alliance) => (
                <AllianceDashboard
                  key={alliance.id}
                  allianceId={alliance.id}
                  countryId={countryId}
                  myRole={alliance.myRole}
                  onLeave={() => void refetchAlliances()}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "exchanges" && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-pink-500" />
            <h3 className="text-sm font-semibold">Cultural Exchanges</h3>
          </div>
          <CulturalExchangeProgram primaryCountry={{ id: countryId, name: countryName }} />
        </section>
      )}

      {activeTab === "events" && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Diplomatic Events</h3>
          </div>
          <DiplomaticEventsHub countryId={countryId} countryName={countryName} />
        </section>
      )}

      {/* ─── Sheets ─── */}
      <EmbassyCreatorSheet
        countryId={countryId}
        countryName={countryName}
        open={showEmbassyCreator}
        onOpenChange={setShowEmbassyCreator}
        onCreated={() => void refetchEmbassies()}
      />

      <EmbassyDetailSheet
        embassyId={selectedEmbassyId}
        onClose={() => setSelectedEmbassyId(null)}
        countryId={countryId}
        onEmbassyChanged={() => void refetchEmbassies()}
      />

      <AllianceCreatorSheet
        countryId={countryId}
        open={showAllianceCreator}
        onOpenChange={setShowAllianceCreator}
        onCreated={() => void refetchAlliances()}
      />

      {/* Legacy shared data modal (embassy synergy detail) */}
      <AnimatePresence>
        {showSharedData && (
          <SharedDataModal
            embassyId={showSharedData}
            onClose={closeSharedDataModal}
            isOwner={isOwner}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Stats Cell ─── */
// oxlint-disable-next-line eslint/no-unused-vars
function StatCell({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="facet-hierarchy-child rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
      </div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}
