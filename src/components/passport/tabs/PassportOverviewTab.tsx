"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChatBubble,
  Crown,
  Discord,
  Globe,
  OpenBook,
  Spark,
  Trophy,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetCard, FACET_INSET_SURFACE } from "~/components/ui/facet-container";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { PassportShowcase } from "../showcase/PassportShowcase";
import type { PassportPayload } from "../types";

interface PassportOverviewTabProps {
  data: PassportPayload;
  cleanUsername: string;
  onOpenVault?: () => void;
}

/** Section header (sentence-case `text-subhead`, Facet 3 §3). */
const SECTION_LABEL = "text-subhead text-label-secondary";

/** An inset panel inside the passport card. */

function FeaturedRealm({ data, cleanUsername }: PassportOverviewTabProps) {
  const realm = data.featuredRealm;
  if (!realm) {
    return (
      <p className="text-label-secondary text-footnote">
        @{cleanUsername} has not claimed a country in any realm yet.
      </p>
    );
  }
  const countryName = realm.country.name.replace(/_/g, " ");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="bg-fill-3 border-separator rounded-row size-14 shrink-0 overflow-hidden border">
          <UnifiedCountryFlag
            countryName={realm.country.name}
            size="lg"
            flagUrl={realm.country.flagUrl}
            fitContainer={true}
            objectFit="cover"
            showTooltip={false}
            rounded={false}
            shadow={false}
            border={false}
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0">
          <p className="text-label text-title-3 truncate">
            {realm.role} of {countryName}
          </p>
          <p className="text-label-secondary text-footnote">
            {realm.name} · {data.realmCount} {data.realmCount === 1 ? "realm" : "realms"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="bordered" size="sm">
          <Link href={`/r/${realm.slug}/${encodeURIComponent(cleanUsername)}`}>
            <Globe aria-hidden />
            <span>In {realm.name}</span>
          </Link>
        </Button>
        <Button asChild variant="tinted" size="sm">
          <Link href={`/countries/${realm.country.slug}`}>
            <span>View Country</span>
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface AffiliationRowProps {
  icon: typeof Globe;
  platform: string;
  linked: boolean;
  name: string | null;
  detail: string | null;
}

function AffiliationRow({ icon: Icon, platform, linked, name, detail }: AffiliationRowProps) {
  return (
    <FacetRow
      leading={<Icon className="size-4" />}
      title={platform}
      trailing={
        <span className="min-w-0 text-right">
          <span
            className={cn(
              "text-footnote block truncate",
              linked && name ? "text-label" : "text-label-secondary"
            )}
          >
            {linked && name ? `@${name}` : "Not linked"}
          </span>
          {linked && detail && (
            <span className="text-label-secondary text-footnote block">{detail}</span>
          )}
        </span>
      }
    />
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Stat
      size="sm"
      label={label}
      value={value}
      hint={sub}
      className={cn(FACET_INSET_SURFACE, "p-3")}
    />
  );
}

/** Civic stature cells; a section the owner hid is left out (the server did not send it). */
function civicStats(data: PassportPayload) {
  const lore = data.wiki.lorewards;
  const laurels = lore ? lore.dailyWins + lore.weeklyWins + lore.monthlyWins : 0;
  const forumStats = data.forum.stats;
  return [
    ...(data.privacy.accolades
      ? [
          {
            label: "Lorewards",
            value: lore?.rank ? `#${lore.rank}` : "Unranked",
            sub: `${(lore?.totalScore ?? 0).toLocaleString()} pts`,
          },
          {
            label: "Streak",
            value: `${lore?.currentStreak ?? 0}d`,
            sub: `Best ${lore?.longestStreak ?? 0}d`,
          },
          { label: "Laurels", value: laurels.toLocaleString(), sub: "Daily · weekly · monthly" },
        ]
      : []),
    ...(data.vault
      ? [
          {
            label: "Collector",
            value: `Lv ${data.vault.collectorLevel}`,
            sub: `${data.vault.collectorXp.toLocaleString()} XP`,
          },
        ]
      : []),
    ...(data.privacy.forumStats
      ? [
          {
            label: "Forum",
            value: forumStats ? forumStats.userTitle || "Member" : "—",
            sub: forumStats
              ? `${forumStats.trophyPoints.toLocaleString()} trophy pts`
              : "Forum stats unavailable",
          },
        ]
      : []),
    {
      label: "WikiOS",
      value: data.wiki.editCount === null ? "-" : data.wiki.editCount.toLocaleString(),
      sub: data.wiki.editCount === null ? "Edit count unavailable" : "Edits",
    },
  ];
}

/**
 * Tab 1 — identity overview: featured realm, the showcase, linked platforms and civic stature
 * (plan 188).
 */
export const PassportOverviewTab = React.memo(function PassportOverviewTab({
  data,
  cleanUsername,
  onOpenVault,
}: PassportOverviewTabProps) {
  const { forum, wiki, thinkpages, discord } = data;
  const forumJoined = forum.joinedDate
    ? `Since ${new Date(forum.joinedDate * 1000).getFullYear()}`
    : null;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className={`flex items-center gap-2 ${SECTION_LABEL}`}>
          <Crown aria-hidden className="size-4" />
          <span>Featured realm</span>
        </h2>
        <FacetCard variant="inset">
          <FeaturedRealm data={data} cleanUsername={cleanUsername} />
        </FacetCard>
      </section>

      <PassportShowcase data={data} cleanUsername={cleanUsername} onOpenVault={onOpenVault} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FacetListSection
          header="Platform affiliations"
          headerAs="h2"
          groupClassName="bg-surface-secondary border-transparent"
        >
          <AffiliationRow
            icon={ChatBubble}
            platform="Forum"
            linked={forum.linked}
            name={forum.username}
            detail={[forum.isStaff ? "Staff" : null, forumJoined].filter(Boolean).join(" · ")}
          />
          <AffiliationRow
            icon={OpenBook}
            platform="WikiOS"
            linked={wiki.linked}
            name={wiki.username}
            detail={wiki.groups.length > 0 ? wiki.groups.join(", ") : null}
          />
          <AffiliationRow
            icon={Spark}
            platform="ThinkPages"
            linked={thinkpages.linked}
            name={thinkpages.username}
            detail={`${thinkpages.postCount} posts · ${thinkpages.followerCount} followers`}
          />
          <AffiliationRow
            icon={Discord}
            platform="Discord"
            linked={discord.linked}
            name={discord.username}
            detail={null}
          />
        </FacetListSection>

        <section className="space-y-3">
          <h2 className={`flex items-center gap-2 ${SECTION_LABEL}`}>
            <Trophy aria-hidden className="size-4" />
            <span>Civic stature</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {civicStats(data).map((stat) => (
              <StatCell key={stat.label} {...stat} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
});
