"use client";

import { useState, useMemo } from "react";
import {
  City as Building2,
  Group as Users,
  Community as Handshake,
  Page as FileText,
  Palette,
  Plus,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { AnimatePresence } from "motion/react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";

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

    const relationsTargetIds = new Set(relations?.map((r) => r.targetCountryId) ?? []);
    let additionalRelationsCount = 0;
    embassiesWithSynergies.forEach((e) => {
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
      {/* ─── Sub-Tab Navigation Bar (shared with the other domain sections) ─── */}
      <SectionTabBar
        tabs={[
          {
            id: "embassies",
            label: "Embassy Network",
            icon: Building2,
            badge: stats.activeEmbassies,
            activeClassName:
              "border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-400",
          },
          {
            id: "relations",
            label: "Bilateral Relations",
            icon: Handshake,
            badge: stats.totalRelations,
            activeClassName: "border-blue-500/40 bg-blue-500/20 text-blue-700 dark:text-blue-400",
          },
          {
            id: "alliances",
            label: "Alliances & Blocs",
            icon: Users,
            badge: stats.allianceCount,
            activeClassName: "border-cyan-500/40 bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
          },
          { id: "exchanges", label: "Cultural Exchanges", icon: Palette },
          { id: "events", label: "Diplomatic Events", icon: FileText },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="border-blue-500/40 bg-blue-500/20 text-blue-700 dark:text-blue-400"
      />

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
              <Users className="h-4 w-4 text-cyan-500" />
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
            <Palette className="h-4 w-4 text-blue-500" />
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
