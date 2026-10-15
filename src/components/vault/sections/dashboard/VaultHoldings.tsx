"use client";

import type { ReactNode } from "react";
import { Medal, MultiplePages, ShoppingBag, Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";
import { pickFeaturedStoreItem } from "~/lib/vault/featured-store-item";
import { Credits, formatCredits } from "./credits";
import { IconWell } from "./IconWell";
import { DailyRewardTile } from "./DailyRewardTile";
import { VaultTitle } from "./VaultTitle";

const plural = (count: number, one: string) =>
  `${count.toLocaleString()} ${one}${count === 1 ? "" : "s"}`;

/** One home in the Vault: a whole-row link with a tinted icon, a chevron and a line of status. */
function Home({
  href,
  title,
  icon,
  children,
}: {
  href: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <FacetRow href={href} title={title} leading={<IconWell>{icon}</IconWell>} subtitle={children} />
  );
}

const Unavailable = () => <span>Unavailable</span>;

function AchievementsHome() {
  const { data: summary, isError } = api.achievements.getMySummary.useQuery();
  return (
    <Home href="/vault/achievements" title="Achievements" icon={<Trophy />}>
      {summary ? (
        <span className="tabular-nums">
          {summary.unlocked} of {summary.activeTotal} · {formatCredits(summary.points)} points
          {summary.rank !== null && ` · #${summary.rank}`}
        </span>
      ) : isError ? (
        <Unavailable />
      ) : (
        <Skeleton as="span" className="mt-1 h-4 w-40" />
      )}
    </Home>
  );
}

const LINK_WIKI_HREF = "/settings?tab=account#ixnayid-card";

function LorewardsHome() {
  const { data: trophies, isError } = api.lorewards.getMyTrophies.useQuery();
  const wins = trophies ? trophies.wins.daily + trophies.wins.weekly + trophies.wins.monthly : 0;
  const unlinked = trophies?.wikiUsername === null;
  return (
    <Home
      href={unlinked ? LINK_WIKI_HREF : "/vault/achievements?tab=lorewards"}
      title="Lorewards"
      icon={<Medal />}
    >
      {trophies ? (
        unlinked ? (
          <span>Link your wiki account to take part</span>
        ) : (
          <span className="tabular-nums">
            {plural(wins, "win")}
            {trophies.todayRank !== null && ` · Today #${trophies.todayRank}`}
          </span>
        )
      ) : isError ? (
        <Unavailable />
      ) : (
        <Skeleton as="span" className="mt-1 h-4 w-32" />
      )}
    </Home>
  );
}

function StoreHome() {
  const { data: items } = api.vault.listStoreItems.useQuery();
  const { data: owned } = api.vault.getPurchasedItems.useQuery();
  const featured = items && owned ? pickFeaturedStoreItem(items, owned.purchaseCounts) : undefined;
  return (
    <Home href="/vault/store" title="Store" icon={<ShoppingBag />}>
      {featured ? (
        <span className="inline-flex max-w-full items-center gap-1 tabular-nums">
          <span className="truncate">{featured.name}</span>
          <span aria-hidden>·</span>
          <Credits amount={featured.price} />
        </span>
      ) : items && owned ? (
        <span>Browse the store</span>
      ) : (
        <Skeleton as="span" className="mt-1 h-4 w-40" />
      )}
    </Home>
  );
}

/** Where the player's things live in the Vault: the page title over one row per home, each a link with its status. */
export function VaultHoldings() {
  return (
    <div data-slot="vault-holdings">
      <VaultTitle />
      <div className="pb-4 empty:hidden">
        <DailyRewardTile />
      </div>
      <FacetList>
        <FacetListSection aria-label="Your Vault">
          <AchievementsHome />
          <LorewardsHome />
          <Home href="/vault/cards" title="Cards" icon={<MultiplePages />}>
            <span>Gallery, inventory and collections</span>
          </Home>
          <StoreHome />
        </FacetListSection>
      </FacetList>
    </div>
  );
}
