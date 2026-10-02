"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  City as Building2,
  Group as Users,
  Community as Handshake,
  Page as FileText,
  Palette,
  Plus,
  MailIn,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";

// Hooks
import { useEmbassyNetworkData } from "~/hooks/useEmbassyNetworkData";
import { useNetworkMetrics } from "~/hooks/useNetworkMetrics";

// Sub-components (embassy network)
import { EmbassyGrid, EmptyState } from "./embassy-network";
import { DiplomaticRelationsList } from "./DiplomaticRelationsList";

// Alliance sub-component
import { AllianceDashboard } from "./alliances/AllianceDashboard";

// Cultural exchanges
import { CulturalExchangeProgram } from "./CulturalExchangeProgram";

// Diplomatic events
import { DiplomaticEventsHub } from "./DiplomaticEventsHub";

// Proposal / invitation inbox
import { DiplomacyInbox } from "./inbox/DiplomacyInbox";
import { useDiplomacyInboxCount } from "./inbox/useDiplomacyInbox";

// Sheets
import { EmbassyCreatorSheet } from "./EmbassyCreatorSheet";
import { EmbassyDetailSheet } from "./EmbassyDetailSheet";
import { AllianceCreatorSheet } from "./AllianceCreatorSheet";
import { Card } from "~/components/ui/card";

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
    "inbox" | "embassies" | "relations" | "alliances" | "exchanges" | "events"
  >("embassies");

  // Determine ownership
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const isOwner = userProfile?.countryId === countryId;

  // Incoming proposals / invitations: open the inbox once on arrival when something is waiting.
  const inbox = useDiplomacyInboxCount(countryId, isOwner);
  const autoOpenedInbox = useRef(false);
  useEffect(() => {
    if (autoOpenedInbox.current || inbox.isLoading || !isOwner) return;
    autoOpenedInbox.current = true;
    // oxlint-disable-next-line
    if (inbox.count > 0) setActiveTab("inbox");
  }, [inbox.isLoading, inbox.count, isOwner]);

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
      <div className="space-y-5" aria-busy="true" aria-label="Loading diplomacy">
        <Skeleton className="rounded-row h-11 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="rounded-card h-40" />
          <Skeleton className="rounded-card h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Sub-Tab Navigation Bar (shared with the other domain sections) ─── */}
      <SectionTabBar
        tabs={[
          ...(isOwner
            ? [
                {
                  id: "inbox" as const,
                  label: "Inbox",
                  icon: MailIn,
                  badge: inbox.count > 0 ? inbox.count : undefined,
                },
              ]
            : []),
          {
            id: "embassies",
            label: "Embassy Network",
            icon: Building2,
            badge: stats.activeEmbassies,
          },
          {
            id: "relations",
            label: "Bilateral Relations",
            icon: Handshake,
            badge: stats.totalRelations,
          },
          {
            id: "alliances",
            label: "Alliances & Blocs",
            icon: Users,
            badge: stats.allianceCount,
          },
          { id: "exchanges", label: "Cultural Exchanges", icon: Palette },
          { id: "events", label: "Diplomatic Events", icon: FileText },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="text-cyan"
      />

      {/* ─── Tab Content Views ─── */}
      {activeTab === "inbox" && isOwner && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MailIn className="text-label-secondary h-4 w-4" />
            <h3 className="text-label text-headline">Diplomatic Inbox</h3>
            <SectionHelpIcon
              title="Diplomatic Inbox"
              content="Free trade and military alliance proposals and alliance invitations need the other nation's consent. Answer incoming ones here, or withdraw your own while they are pending. Unanswered items expire after 14 days."
            />
          </div>
          <DiplomacyInbox countryId={countryId} />
        </section>
      )}

      {activeTab === "embassies" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="text-label-secondary h-4 w-4" />
              <h3 className="text-label text-headline">Embassy Network</h3>
              <SectionHelpIcon
                title="Embassy Network"
                content="Manage your diplomatic embassies. Embassies provide synergy bonuses based on shared government components and improve bilateral relations with host nations."
              />
            </div>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
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
            <Handshake className="text-label-secondary h-4 w-4" />
            <h3 className="text-label text-headline">Diplomatic Relations</h3>
          </div>
          <DiplomaticRelationsList countryId={countryId} />
        </section>
      )}

      {activeTab === "alliances" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="text-label-secondary h-4 w-4" />
              <h3 className="text-label text-headline">Alliances & Blocs</h3>
              <SectionHelpIcon
                title="Alliances & Blocs"
                content="Form and manage alliances with other nations. Alliances provide mutual defense benefits, trade advantages, and diplomatic leverage."
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowAllianceCreator(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Alliance
            </Button>
          </div>

          {!alliances || alliances.length === 0 ? (
            <Card className="rounded-card p-6 text-center">
              <Users className="text-label-secondary mx-auto mb-3 h-6 w-6" />
              <p className="text-label-secondary text-body">
                Not a member of any alliances. Create one or wait for an invitation.
              </p>
            </Card>
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
            <Palette className="text-label-secondary h-4 w-4" />
            <h3 className="text-label text-headline">Cultural Exchanges</h3>
          </div>
          <CulturalExchangeProgram primaryCountry={{ id: countryId, name: countryName }} />
        </section>
      )}

      {activeTab === "events" && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="text-label-secondary h-4 w-4" />
            <h3 className="text-label text-headline">Diplomatic Events</h3>
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
    </div>
  );
}
