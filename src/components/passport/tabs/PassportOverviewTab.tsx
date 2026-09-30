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
import { FacetCard } from "~/components/ui/facet-container";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { PassportShowcase } from "../showcase/PassportShowcase";
import type { PassportPayload } from "../types";

interface PassportOverviewTabProps {
  data: PassportPayload;
  cleanUsername: string;
  onOpenVault?: () => void;
}

const SECTION_LABEL =
  "text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase";

const PANEL =
  "rounded-3xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]";

function FeaturedRealm({ data, cleanUsername }: PassportOverviewTabProps) {
  const realm = data.featuredRealm;
  if (!realm) {
    return (
      <p className="text-muted-foreground text-xs">
        @{cleanUsername} has not claimed a country in any realm yet.
      </p>
    );
  }
  const countryName = realm.country.name.replace(/_/g, " ");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="bg-muted/40 h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-black/15 dark:border-white/20">
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
          <p className="text-foreground truncate text-lg font-bold tracking-tight">
            {realm.role} of {countryName}
          </p>
          <p className="text-muted-foreground font-mono text-xs uppercase">
            {realm.name} · {data.realmCount} {data.realmCount === 1 ? "realm" : "realms"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/r/${realm.slug}/${encodeURIComponent(cleanUsername)}`}
          data-cuelume-press="soft"
          className="text-foreground inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3.5 py-2 text-xs font-semibold transition-[background-color,transform] hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/15 dark:hover:bg-white/[0.05]"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>In {realm.name}</span>
        </Link>
        <Link
          href={`/countries/${realm.country.slug}`}
          data-cuelume-press="soft"
          className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
        >
          <span>View Country</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
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
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="text-foreground text-sm font-semibold">{platform}</span>
      </div>
      <div className="min-w-0 text-right">
        <p className="text-foreground truncate font-mono text-xs">
          {linked && name ? `@${name}` : "Not linked"}
        </p>
        {linked && detail && <p className="text-muted-foreground font-mono text-xs">{detail}</p>}
      </div>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="space-y-0.5 rounded-2xl border border-black/6 bg-black/[0.02] p-3 dark:border-white/8 dark:bg-white/[0.02]">
      <span className="text-muted-foreground block font-mono text-xs uppercase">{label}</span>
      <p className="text-foreground text-sm font-bold">{value}</p>
      <p className="text-muted-foreground truncate font-mono text-xs">{sub}</p>
    </div>
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
        <h2 className={`flex items-center gap-1.5 ${SECTION_LABEL}`}>
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <span>Featured Realm</span>
        </h2>
        <FacetCard depth={1} className={PANEL}>
          <FeaturedRealm data={data} cleanUsername={cleanUsername} />
        </FacetCard>
      </section>

      <PassportShowcase data={data} cleanUsername={cleanUsername} onOpenVault={onOpenVault} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className={SECTION_LABEL}>Platform Affiliations</h2>
          <div className="divide-y divide-black/6 rounded-3xl border border-black/8 bg-black/[0.015] px-5 py-1 dark:divide-white/8 dark:border-white/10 dark:bg-white/[0.02]">
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
          </div>
        </section>

        <section className="space-y-3">
          <h2 className={`flex items-center gap-1.5 ${SECTION_LABEL}`}>
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span>Civic Stature</span>
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {civicStats(data).map((stat) => (
              <StatCell key={stat.label} {...stat} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
});
