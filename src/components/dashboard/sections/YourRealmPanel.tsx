"use client";

import { useState } from "react";
import Link from "next/link";
import { NavArrowDown } from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { RealmMapFace } from "~/components/realms/RealmMapFace";
import { Button } from "~/components/ui/button";
import { LensCard } from "~/components/ui/lens-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { BoardPreviewList } from "~/components/thinkpages-forum/realm/BoardPreviewList";
import { useClockNow } from "~/hooks/useNationClock";
import { useRealmClock } from "~/hooks/useRealmClock";
import { formatNationDateLine } from "~/lib/realms/nation-time";
import { IXNAY_SLUG } from "~/lib/realms/realm-ids";
import { hubHref, realmBoardHref } from "~/lib/thinkpages-forum/links";
import { countLabel } from "~/lib/thinkpages-forum/unread";
import { api } from "~/trpc/react";

/** The art strip is short so the board stays above the fold of a 320px Inspector. */
const PANEL_POSTS = 2;

type PanelRealm = { id: string; slug: string; name: string };

const PICK_KEY = "ixstats:dashboard-realm";

/** The realm the viewer last picked; null on the server and when storage is blocked. */
function readPick(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

function writePick(slug: string | null) {
  try {
    if (slug) window.localStorage.setItem(PICK_KEY, slug);
    else window.localStorage.removeItem(PICK_KEY);
  } catch {
    // Storage blocked (private mode): the pick still holds for this visit.
  }
}

/** The realm name, and a menu of the viewer's other realms when they hold nations in more than one. */
function RealmName({
  current,
  realms,
  onPick,
}: {
  current: PanelRealm;
  realms: readonly PanelRealm[];
  onPick: (slug: string) => void;
}) {
  const heading = <h2 className="text-title-3 text-label truncate">{current.name}</h2>;
  if (realms.length < 2) return heading;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Showing ${current.name}. Choose a realm`}
        className="hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm -mx-1 flex max-w-full min-w-0 items-center gap-1 px-1 focus-visible:outline-2 pointer-coarse:min-h-11"
      >
        {heading}
        <NavArrowDown aria-hidden className="text-label-secondary size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={current.id}
          onValueChange={(id) => {
            const realm = realms.find((r) => r.id === id);
            if (realm) onPick(realm.slug);
          }}
        >
          {realms.map((realm) => (
            <DropdownMenuRadioItem key={realm.id} value={realm.id}>
              {realm.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Home's "Your realm": the realm's face (banner, else its political map) under its crest and name, the realm's own
 * date, then its board: how many messages are new (the sidebar's `navCounts`, home realm only) and the newest two.
 * A viewer with nations in several realms can switch which realm it shows, remembered in this browser (and dropped once
 * they no longer hold a nation there). Nothing while it loads and nothing without a realm, so the rail never shifts.
 */
export function YourRealmPanel() {
  const { isSignedIn } = useUser();
  // The panel renders nothing until its queries land on the client, so reading storage here cannot mismatch hydration.
  const [restoredSlug] = useState(readPick);
  const [storedSlug, setStoredSlug] = useState(restoredSlug);
  const mine = api.realms.myNations.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
  });
  const realms = (mine.data?.realms ?? []).map((r) => ({
    id: r.id,
    slug: r.slug ?? IXNAY_SLUG,
    name: r.name,
  }));
  const pickedSlug =
    storedSlug && (!mine.data || realms.some((r) => r.slug === storedSlug)) ? storedSlug : null;
  const home = api.thinkpagesForum.realmPanel.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const picked = api.thinkpagesForum.realmBoardPreview.useQuery(
    { slug: pickedSlug ?? "" },
    { enabled: !!pickedSlug, staleTime: 60_000, refetchOnWindowFocus: false, retry: false }
  );
  const counts = api.thinkpagesForum.navCounts.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // A switch keeps the current realm up while the next one loads; a restored pick waits, so the home realm never flashes first.
  const restoring = pickedSlug !== null && pickedSlug === restoredSlug && picked.isLoading;
  const data = restoring ? undefined : (pickedSlug && picked.data) || home.data;
  const reader = useRealmClock(data?.realm.id);
  const now = useClockNow(reader);
  if (!data) return null;

  const { realm, messages } = data;
  const isHome = realm.id === home.data?.realm.id;
  const fresh = isHome ? counts.data?.realmBoardNew : undefined;
  const pick = (slug: string) => {
    const next = slug === home.data?.realm.slug ? null : slug;
    setStoredSlug(next);
    writePick(next);
  };
  const badge = {
    id: realm.id,
    slug: realm.slug,
    name: realm.name,
    crestUrl: realm.emblemUrl || realm.thumbnail,
    isSystem: false,
  };

  return (
    <LensCard
      app="realms"
      content="entity"
      role="region"
      aria-label={`Your realm, ${realm.name}`}
      className="overflow-hidden"
    >
      <div data-app="realms" className="relative">
        <div aria-hidden className="h-24 overflow-hidden">
          <RealmMapFace realm={badge} bannerUrl={realm.bannerUrl} showCrest={false} />
        </div>
        <RealmCrest
          realm={badge}
          size="md"
          className="ring-surface absolute -bottom-5 left-4 ring-3"
        />
      </div>

      <div className="space-y-3 p-4 pt-7">
        <div className="min-w-0">
          <RealmName current={realm} realms={realms} onPick={pick} />
          <p className="text-footnote text-label-secondary tabular-nums">
            <span className="sr-only">Realm date: </span>
            {formatNationDateLine(now, reader)}
          </p>
        </div>

        <div className="border-separator space-y-2 border-t pt-3">
          {fresh === undefined ? null : (
            <p className="text-subhead text-label tabular-nums">
              {fresh > 0 ? `${countLabel(fresh)} new on the board` : "Up to date on the board"}
            </p>
          )}
          {messages.length === 0 ? (
            <p className="text-label-secondary text-footnote">
              No messages on the board yet. Start the conversation.
            </p>
          ) : (
            <BoardPreviewList messages={messages.slice(0, PANEL_POSTS)} />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="flex-1 pointer-coarse:min-h-11">
            <Link href={realmBoardHref(realm.slug)}>Open the board</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="pointer-coarse:min-h-11">
            <Link href={hubHref(realm.slug)}>Forums</Link>
          </Button>
        </div>
      </div>
    </LensCard>
  );
}
