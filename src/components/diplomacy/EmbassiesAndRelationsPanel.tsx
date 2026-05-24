"use client";

import { useState, useMemo } from "react";
import {
  Building2,
  Globe,
  Users,
  Handshake,
  FileText,
  Palette,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { AnimatePresence } from "motion/react";

// Hooks
import { useEmbassyNetworkData } from "~/hooks/useEmbassyNetworkData";
import { useNetworkMetrics } from "~/hooks/useNetworkMetrics";
import { useSharedDataModal } from "~/hooks/useSharedDataModal";

// Sub-components (embassy network)
import {
  NetworkOverviewCard,
  EmbassyGrid,
  EmptyState,
} from "~/components/diplomatic/embassy-network";
import { SharedDataModal } from "~/components/diplomatic/SharedDataModal";

// Alliance sub-component
import { AllianceDashboard } from "./alliances/AllianceDashboard";

// Cultural exchanges
import { CulturalExchangeProgram } from "~/components/diplomatic/CulturalExchangeProgram";

// Diplomatic events
import { DiplomaticEventsHub } from "~/app/mycountry/diplomacy/_components/DiplomaticEventsHub";

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

  // Collapsible sections
  const [exchangesExpanded, setExchangesExpanded] = useState(false);
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
  const networkMetrics = useNetworkMetrics(embassiesWithSynergies);

  // Shared data modal (embassy synergy detail — legacy)
  const { showSharedData, closeModal: closeSharedDataModal } = useSharedDataModal();

  // Relations data
  const { data: relations } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Alliances data
  const { data: alliances, refetch: refetchAlliances } = api.diplomatic.getAlliances.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Stats
  const stats = useMemo(() => {
    const activeEmbassies = embassiesWithSynergies.filter(
      (e) => e.status === "ACTIVE" || e.status === "active"
    ).length;
    const totalRelations = relations?.length ?? 0;
    const allianceCount = alliances?.length ?? 0;
    const avgStrength =
      totalRelations > 0
        ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
        : 0;

    return { activeEmbassies, totalRelations, allianceCount, avgStrength };
  }, [embassiesWithSynergies, relations, alliances]);

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
      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCell
          icon={Building2}
          label="Embassies"
          value={stats.activeEmbassies}
          color="text-cyan-600"
        />
        <StatCell
          icon={Handshake}
          label="Relations"
          value={stats.totalRelations}
          color="text-blue-600"
        />
        <StatCell
          icon={Users}
          label="Alliances"
          value={stats.allianceCount}
          color="text-purple-600"
        />
        <StatCell
          icon={Globe}
          label="Avg Strength"
          value={`${stats.avgStrength}%`}
          color="text-emerald-600"
        />
      </div>

      {/* ─── Embassy Network ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-600" />
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

        {/* Network overview metrics */}
        {networkMetrics && <NetworkOverviewCard networkMetrics={networkMetrics} />}

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

      <Separator />

      {/* ─── Alliances & Blocs ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
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

      <Separator />

      {/* ─── Cultural Exchanges (collapsible) ─── */}
      <section className="space-y-3">
        <button
          className="hover:bg-muted/50 flex w-full items-center justify-between rounded-md px-1 py-0.5 transition-colors"
          onClick={() => setExchangesExpanded(!exchangesExpanded)}
        >
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-pink-600" />
            <h3 className="text-sm font-semibold">Cultural Exchanges</h3>
          </div>
          {exchangesExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
        </button>

        {exchangesExpanded && (
          <CulturalExchangeProgram primaryCountry={{ id: countryId, name: countryName }} />
        )}
      </section>

      <Separator />

      {/* ─── Diplomatic Events (collapsible) ─── */}
      <section className="space-y-3">
        <button
          className="hover:bg-muted/50 flex w-full items-center justify-between rounded-md px-1 py-0.5 transition-colors"
          onClick={() => setEventsExpanded(!eventsExpanded)}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Diplomatic Events</h3>
          </div>
          {eventsExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
        </button>

        {eventsExpanded && <DiplomaticEventsHub countryId={countryId} countryName={countryName} />}
      </section>

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
    <div className="glass-hierarchy-child rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} />
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
      </div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}
