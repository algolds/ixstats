"use client";

import { Fragment, use, useEffect } from "react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { EmptyState } from "~/components/ui/empty-state";
import { ClaimsTab } from "~/app/admin/realms/_components/ClaimsTab";
import { SourceSyncPanel } from "~/app/admin/realms/_components/source-sync/SourceSyncPanel";
import { RealmWikiPanel } from "~/app/admin/realms/_components/wiki/RealmWikiPanel";
import { MapPipelinePanel } from "~/app/admin/realms/_components/map-pipeline/MapPipelinePanel";
import { AdvertSection } from "../../_components/manage/AdvertSection";
import { CardCategoriesSection } from "../../_components/manage/cards/CardCategoriesSection";
import { AppearanceSection } from "../../_components/manage/AppearanceSection";
import { EmbassiesSection } from "../../_components/manage/EmbassiesSection";
import { FactbookSection } from "../../_components/manage/FactbookSection";
import { ForumModerationSection } from "../../_components/manage/ForumModerationSection";
import { HandOverSection } from "../../_components/manage/HandOverSection";
import { InactivitySection } from "../../_components/manage/InactivitySection";
import { LinksSection } from "../../_components/manage/LinksSection";
import { MapSection } from "../../_components/manage/MapSection";
import { MapImportSection } from "../../_components/manage/MapImportSection";
import { ManageNav } from "../../_components/manage/ManageNav";
import { ManageSection } from "../../_components/manage/ManageSection";
import { OfficersSection } from "../../_components/manage/OfficersSection";
import { PollsSection } from "../../_components/manage/PollsSection";
import { RulesSection } from "../../_components/manage/RulesSection";
import { RealmTimeSection } from "../../_components/manage/RealmTimeSection";

/** The Manage tab: the sections the founder or an officer's powers allow. */
export default function RealmManagePage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const {
    data: manage,
    isLoading,
    error,
  } = api.realms.region.manage.useQuery({ slug }, { retry: false });
  usePageTitle({ title: manage ? `${manage.realm.name} · Manage` : "Manage realm" });
  const loaded = !!manage;
  useEffect(() => {
    if (loaded && window.location.hash)
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loaded]);

  if (isLoading) return <p className="text-label-secondary text-body">Loading…</p>;
  if (!manage) {
    const title = "You can't manage this realm";
    // The server's refusal says the same as the title; only another reason (no such realm) is worth showing.
    const reason = error?.message && error.message !== title ? error.message : null;
    return <EmptyState title={title} message={reason ?? "Only its founder and officers can."} />;
  }

  const can = (power: string) => manage.powers.includes(power as never);
  const editable = !manage.archived;
  // One list drives the nav and the page: a section shows when its node is not falsy.
  const groups = [
    {
      label: "Profile",
      sections: [
        {
          id: "appearance",
          label: "Appearance",
          node: manage.appearance && (
            <AppearanceSection slug={slug} appearance={manage.appearance} />
          ),
        },
        {
          id: "advert",
          label: "Advert",
          node: can("appearance") && (
            <AdvertSection slug={slug} realmId={manage.realm.id} archived={manage.archived} />
          ),
        },
        {
          id: "links",
          label: "Links",
          node: manage.links && <LinksSection slug={slug} links={manage.links} />,
        },
      ],
    },
    {
      label: "Pages",
      sections: [
        {
          id: "factbook",
          label: "Factbook",
          node: manage.factbook && (
            <FactbookSection slug={slug} realmName={manage.realm.name} factbook={manage.factbook} />
          ),
        },
        {
          id: "rules",
          label: "Rules",
          node: manage.rules && <RulesSection slug={slug} rules={manage.rules} />,
        },
      ],
    },
    {
      label: "Members",
      sections: [
        {
          id: "officers",
          label: "Officers",
          node: <OfficersSection slug={slug} manage={manage} />,
        },
        {
          id: "claims",
          label: "Claims",
          node: can("claims") && (
            <ManageSection
              id="claims"
              title="Claims"
              description="Players asking to take a nation of the realm. The founder, officers with the Claims power and site staff review them."
            >
              <ClaimsTab realmId={manage.realm.id} canApproveOwn={manage.isFounder} />
            </ManageSection>
          ),
        },
        {
          id: "inactivity",
          label: "Inactive nations",
          node: manage.inactivity && editable && (
            <InactivitySection slug={slug} inactivity={manage.inactivity} />
          ),
        },
        {
          id: "board",
          label: "Forum moderation",
          node: can("board") && <ForumModerationSection slug={slug} />,
        },
      ],
    },
    {
      label: "Diplomacy",
      sections: [
        {
          id: "embassies",
          label: "Embassies",
          node: can("diplomacy") && <EmbassiesSection slug={slug} manage={manage} />,
        },
        {
          id: "polls",
          label: "Poll",
          node: can("diplomacy") && <PollsSection slug={slug} manage={manage} />,
        },
      ],
    },
    {
      label: "Map",
      sections: [
        { id: "map", label: "Map", node: can("map") && editable && <MapSection slug={slug} /> },
        {
          id: "map-import",
          label: "Map import",
          node: can("map") && editable && <MapImportSection realmId={manage.realm.id} />,
        },
        {
          id: "map-pipeline",
          label: "Map pipeline",
          node: can("map") && editable && (
            <ManageSection
              id="map-pipeline"
              title="Map pipeline"
              description="Build the realm's map from its art: raster layers, physical layers, labels, flags and the default view, from a preset or typed here. Dry run first, then apply."
            >
              <MapPipelinePanel slug={slug} />
            </ManageSection>
          ),
        },
      ],
    },
    {
      label: "Cards",
      sections: [
        {
          id: "card-categories",
          label: "Card categories",
          node: manage.isFounder && editable && <CardCategoriesSection slug={slug} />,
        },
      ],
    },
    {
      label: "Founder",
      sections: [
        {
          id: "time",
          label: "Time",
          node: manage.time && <RealmTimeSection slug={slug} time={manage.time} />,
        },
        {
          id: "source-sync",
          label: "Source sync",
          node: manage.isFounder && (
            <ManageSection
              id="source-sync"
              title="Source sync"
              description="Keep the realm's nations, figures, borders and alliances in step with an outside source, such as a community map. Only the founder (and site staff) manage it."
            >
              <SourceSyncPanel slug={slug} />
            </ManageSection>
          ),
        },
        {
          id: "wiki",
          label: "Wiki",
          node: manage.isFounder && (
            <ManageSection
              id="wiki"
              title="Wiki"
              description="The wiki the realm's lore lives on, discovery of its nations and world maps, and the map chosen from it. Only the founder (and site staff) manage it."
            >
              <RealmWikiPanel slug={slug} />
            </ManageSection>
          ),
        },
        {
          id: "handover",
          label: "Hand over",
          node: manage.canHandOver && <HandOverSection slug={slug} manage={manage} />,
        },
      ],
    },
  ]
    .map((group) => ({ ...group, sections: group.sections.filter((s) => s.node) }))
    .filter((group) => group.sections.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <ManageNav
        groups={groups.map((g) => ({
          label: g.label,
          sections: g.sections.map((sec) => ({ id: sec.id, label: sec.label })),
        }))}
      />

      <div className="flex min-w-0 flex-col gap-6">
        {manage.archived && (
          <p className="text-label-secondary text-footnote">
            This realm is archived: nothing here can be changed.
          </p>
        )}
        {groups.flatMap((group) =>
          group.sections.map((s) => <Fragment key={s.id}>{s.node}</Fragment>)
        )}
      </div>
    </div>
  );
}
