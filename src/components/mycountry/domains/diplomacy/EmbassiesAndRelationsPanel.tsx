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
import { EmptyState as FacetEmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";

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

type DiplomacyTab = "inbox" | "embassies" | "relations" | "alliances" | "programs";

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

function PanelToolbar({
  helpTitle,
  help,
  action,
}: {
  helpTitle: string;
  help?: string;
  action?: React.ReactNode;
}) {
  if (!help && !action) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {help ? (
        <p className="text-label-secondary text-footnote flex items-center gap-1.5">
          <span>About {helpTitle.toLowerCase()}</span>
          <SectionHelpIcon title={helpTitle} content={help} />
        </p>
      ) : (
        <span />
      )}
      {action}
    </div>
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
    data: embassies = [],
    isLoading: embassiesLoading,
    refetch: refetchEmbassies,
  } = api.diplomaticEmbassies.getEmbassies.useQuery({ countryId });

  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: alliances, refetch: refetchAlliances } =
    api.diplomaticPolicies.getAlliances.useQuery({ countryId }, { enabled: !!countryId });

  const stats = computeStats(embassies, relations ?? [], alliances?.length ?? 0, countryId);
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
    <div className="space-y-4">
      <SectionTabBar
        aria-label="Diplomacy sections"
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
            label: "Embassies",
            icon: Building2,
            badge: stats.activeEmbassies,
          },
          {
            id: "relations",
            label: "Relations",
            icon: Handshake,
            badge: stats.totalRelations,
          },
          {
            id: "alliances",
            label: "Alliances",
            icon: Users,
            badge: stats.allianceCount,
          },
          { id: "programs", label: "Programs & events", icon: Palette },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "inbox" && isOwner && (
        <section className="space-y-3" aria-label="Diplomatic inbox">
          <PanelToolbar
            helpTitle="Diplomatic inbox"
            help="Free trade and military alliance proposals and alliance invitations need the other nation's consent. Answer incoming ones here, or withdraw your own while they are pending. Unanswered items expire after 14 days."
          />
          <DiplomacyInbox countryId={countryId} />
        </section>
      )}

      {activeTab === "embassies" && (
        <section className="space-y-3" aria-label="Embassy network">
          <PanelToolbar
            helpTitle="Embassy network"
            help="Your embassies abroad and the embassies other nations keep with you. Opening one starts formal relations with the host, and cultural exchange missions build its experience, influence and reputation."
            action={
              isOwner && (
                <CreateButton label="Establish embassy" onClick={() => setShowEmbassyCreator(true)} />
              )
            }
          />
          {embassies.length > 0 ? (
            <EmbassyGrid
              embassies={embassies}
              isOwner={isOwner}
              onEmbassyClick={(id) => setSelectedEmbassyId(id)}
            />
          ) : (
            <EmptyState isOwner={isOwner} onEstablishEmbassy={() => setShowEmbassyCreator(true)} />
          )}
        </section>
      )}

      {activeTab === "relations" && (
        <section className="space-y-3" aria-label="Bilateral relations">
          <DiplomaticRelationsList countryId={countryId} />
        </section>
      )}

      {activeTab === "alliances" && (
        <section className="space-y-3" aria-label="Alliances and blocs">
          <PanelToolbar
            helpTitle="Alliances and blocs"
            help="Form and manage alliances with other nations. Alliances give mutual defense, trade advantages and diplomatic standing."
            action={
              <CreateButton label="Create alliance" onClick={() => setShowAllianceCreator(true)} />
            }
          />
          {!alliances || alliances.length === 0 ? (
            <Card className="rounded-card">
              <FacetEmptyState
                compact
                icon={<Users />}
                title="Not a member of any alliances"
                message="Create one or wait for an invitation."
              />
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

      {activeTab === "programs" && (
        <div className="space-y-6">
          <section className="space-y-3" aria-label="Diplomatic events">
            <div className="flex items-center gap-2">
              <FileText className="text-label-secondary h-4 w-4" aria-hidden="true" />
              <h3 className="text-label text-headline">Diplomatic events</h3>
            </div>
            <DiplomaticEventsHub countryId={countryId} countryName={countryName} />
          </section>

          <hr className="border-separator/60" />

          <section className="space-y-3" aria-label="Cultural exchanges">
            <CulturalExchangeProgram primaryCountry={{ id: countryId, name: countryName }} />
          </section>
        </div>
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
