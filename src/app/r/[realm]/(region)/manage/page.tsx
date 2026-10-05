"use client";

import { use } from "react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { EmptyState } from "~/components/ui/empty-state";
import { ClaimsTab } from "~/app/admin/realms/_components/ClaimsTab";
import { AppearanceSection } from "../../_components/manage/AppearanceSection";
import { BoardModerationSection } from "../../_components/manage/BoardModerationSection";
import { EmbassiesSection } from "../../_components/manage/EmbassiesSection";
import { FactbookSection } from "../../_components/manage/FactbookSection";
import { ManageSection } from "../../_components/manage/ManageSection";
import { OfficersSection } from "../../_components/manage/OfficersSection";
import { PollsSection } from "../../_components/manage/PollsSection";

/** The Manage tab: the sections the founder or an officer's powers allow. */
export default function RealmManagePage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const {
    data: manage,
    isLoading,
    error,
  } = api.realms.region.manage.useQuery({ slug }, { retry: false });
  usePageTitle({ title: manage ? `${manage.realm.name} · Manage` : "Manage realm" });

  if (isLoading) return <p className="text-label-secondary text-body">Loading…</p>;
  if (!manage)
    return (
      <EmptyState
        title="You can't manage this realm"
        message={error?.message ?? "Only its founder and officers can."}
      />
    );

  const can = (power: string) => manage.powers.includes(power as never);
  const sections = [
    manage.appearance && { id: "appearance", label: "Appearance" },
    manage.factbook && { id: "factbook", label: "Factbook" },
    { id: "officers", label: "Officers" },
    manage.isFounder && { id: "claims", label: "Claims" },
    can("diplomacy") && { id: "embassies", label: "Embassies" },
    can("diplomacy") && { id: "polls", label: "Poll" },
    can("board") && { id: "board", label: "Board moderation" },
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Manage sections" className="lg:sticky lg:top-24 lg:self-start">
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="rounded-control text-footnote text-label-secondary hover:bg-fill-4 hover:text-label block px-3 py-2"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        {manage.archived && (
          <p className="text-label-secondary text-footnote">
            This realm is archived: nothing here can be changed.
          </p>
        )}
        {manage.appearance && <AppearanceSection slug={slug} appearance={manage.appearance} />}
        {manage.factbook && (
          <FactbookSection slug={slug} realmName={manage.realm.name} factbook={manage.factbook} />
        )}
        <OfficersSection slug={slug} manage={manage} />
        {manage.isFounder && (
          <ManageSection
            id="claims"
            title="Claims"
            description="Players asking to take a nation of the realm. Only the founder (and site staff) review them."
          >
            <ClaimsTab realmId={manage.realm.id} />
          </ManageSection>
        )}
        {can("diplomacy") && <EmbassiesSection slug={slug} manage={manage} />}
        {can("diplomacy") && <PollsSection slug={slug} manage={manage} />}
        {can("board") && <BoardModerationSection slug={slug} manage={manage} />}
      </div>
    </div>
  );
}
