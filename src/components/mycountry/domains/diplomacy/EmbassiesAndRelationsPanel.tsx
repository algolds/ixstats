"use client";

import { useState, useEffect, useRef } from "react";
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

import { useEmbassyNetworkData } from "~/hooks/useEmbassyNetworkData";

import { EmbassyGrid, EmptyState } from "./embassy-network";
import { DiplomaticRelationsList } from "./DiplomaticRelationsList";

import { AllianceDashboard } from "./alliances/AllianceDashboard";

import { CulturalExchangeProgram } from "./CulturalExchangeProgram";

import { DiplomaticEventsHub } from "./DiplomaticEventsHub";

import { DiplomacyInbox } from "./inbox/DiplomacyInbox";
import { useDiplomacyInboxCount } from "./inbox/useDiplomacyInbox";

import { EmbassyCreatorSheet } from "./EmbassyCreatorSheet";
import { EmbassyDetailSheet } from "./EmbassyDetailSheet";
import { AllianceCreatorSheet } from "./AllianceCreatorSheet";
import { Card } from "~/components/ui/card";

interface EmbassiesAndRelationsPanelProps {
  countryId: string;
}

type DiplomacyTab = "inbox" | "embassies" | "relations" | "alliances" | "exchanges" | "events";

/** Counts for the tab badges. Active embassies without a relation record count as relations. */
function computeStats(
  embassies: { status: string; guestCountryId: string; hostCountryId: string }[],
  relations: { targetCountryId: string }[],
  allianceCount: number,
  countryId: string
) {
  const active = embassies.filter((e) => e.status === "ACTIVE" || e.status === "active");
  const related = new Set(relations.map((r) => r.targetCountryId));
  const unrelatedPartners = new Set(
    active
      .map((e) => (e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId))
      .filter((id) => !related.has(id))
  );
  return {
    activeEmbassies: active.length,
    totalRelations: relations.length + unrelatedPartners.size,
    allianceCount,
  };
}

function PanelSection({
  icon: Icon,
  title,
  help,
  action,
  children,
}: {
  icon: typeof Building2;
  title: string;
  /** Tooltip text; omitted for sections without a help icon. */
  help?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const heading = (
    <div className="flex items-center gap-2">
      <Icon className="text-label-secondary h-4 w-4" />
      <h3 className="text-label text-headline">{title}</h3>
      {help && <SectionHelpIcon title={title} content={help} />}
    </div>
  );
  return (
    <section className="space-y-3">
      {action ? (
        <div className="flex items-center justify-between">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}

function CreateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export function EmbassiesAndRelationsPanel({ countryId }: EmbassiesAndRelationsPanelProps) {
  const { user } = useUser();

  const [showEmbassyCreator, setShowEmbassyCreator] = useState(false);
  const [selectedEmbassyId, setSelectedEmbassyId] = useState<string | null>(null);
  const [showAllianceCreator, setShowAllianceCreator] = useState(false);
  const [activeTab, setActiveTab] = useState<DiplomacyTab>("embassies");

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

  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  const {
    embassiesWithSynergies,
    isLoading: embassiesLoading,
    refetch: refetchEmbassies,
  } = useEmbassyNetworkData(countryId, isOwner);

  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: alliances, refetch: refetchAlliances } =
    api.diplomaticPolicies.getAlliances.useQuery({ countryId }, { enabled: !!countryId });

  const stats = computeStats(
    embassiesWithSynergies,
    relations ?? [],
    alliances?.length ?? 0,
    countryId
  );
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
            label: "Embassy network",
            icon: Building2,
            badge: stats.activeEmbassies,
          },
          {
            id: "relations",
            label: "Bilateral relations",
            icon: Handshake,
            badge: stats.totalRelations,
          },
          {
            id: "alliances",
            label: "Alliances & blocs",
            icon: Users,
            badge: stats.allianceCount,
          },
          { id: "exchanges", label: "Cultural exchanges", icon: Palette },
          { id: "events", label: "Diplomatic events", icon: FileText },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="text-cyan"
      />

      {activeTab === "inbox" && isOwner && (
        <PanelSection
          icon={MailIn}
          title="Diplomatic inbox"
          help="Free trade and military alliance proposals and alliance invitations need the other nation's consent. Answer incoming ones here, or withdraw your own while they are pending. Unanswered items expire after 14 days."
        >
          <DiplomacyInbox countryId={countryId} />
        </PanelSection>
      )}

      {activeTab === "embassies" && (
        <PanelSection
          icon={Building2}
          title="Embassy network"
          help="Manage your diplomatic embassies. Embassies provide synergy bonuses based on shared government components and improve bilateral relations with host nations."
          action={
            isOwner && (
              <CreateButton label="Establish embassy" onClick={() => setShowEmbassyCreator(true)} />
            )
          }
        >
          {embassiesWithSynergies.length > 0 ? (
            <EmbassyGrid
              embassies={embassiesWithSynergies}
              isOwner={isOwner}
              onEmbassyClick={(id) => setSelectedEmbassyId(id)}
            />
          ) : (
            <EmptyState isOwner={isOwner} onEstablishEmbassy={() => setShowEmbassyCreator(true)} />
          )}
        </PanelSection>
      )}

      {activeTab === "relations" && (
        <PanelSection icon={Handshake} title="Diplomatic relations">
          <DiplomaticRelationsList countryId={countryId} />
        </PanelSection>
      )}

      {activeTab === "alliances" && (
        <PanelSection
          icon={Users}
          title="Alliances & blocs"
          help="Form and manage alliances with other nations. Alliances give mutual defense, trade advantages and diplomatic standing."
          action={
            <CreateButton label="Create alliance" onClick={() => setShowAllianceCreator(true)} />
          }
        >
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
        </PanelSection>
      )}

      {activeTab === "exchanges" && (
        <PanelSection icon={Palette} title="Cultural exchanges">
          <CulturalExchangeProgram primaryCountry={{ id: countryId, name: countryName }} />
        </PanelSection>
      )}

      {activeTab === "events" && (
        <PanelSection icon={FileText} title="Diplomatic events">
          <DiplomaticEventsHub countryId={countryId} countryName={countryName} />
        </PanelSection>
      )}

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
