"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";
import { RealmFeed } from "~/app/r/[realm]/_components/RealmFeed";
import type { DirectoryRealm } from "./realm-directory";

const ALL = "__all__";

/** The ThinkPages feed for one realm (the viewer's active nation's by default) or for all of them. */
export function RealmFeedPanel({ realms }: { realms: DirectoryRealm[] | undefined }) {
  const viewerRealmId = useViewerRealmId();
  // undefined = not chosen yet: follow the active nation's realm, else all realms.
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const selected = choice ?? viewerRealmId ?? ALL;

  return (
    <Card
      content="feed"
      padding="md"
      aria-labelledby="realm-feed-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="realm-feed-heading" className="text-label text-headline">
          Realm feed
        </h2>
        <div className="text-label-secondary text-footnote flex items-center gap-2">
          <span id="realm-feed-scope">Showing</span>
          <Select value={selected} onValueChange={setChoice}>
            <SelectTrigger size="sm" aria-labelledby="realm-feed-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={ALL}>All realms</SelectItem>
              {selected !== ALL && !realms?.some((realm) => realm.id === selected) && (
                <SelectItem value={selected}>Your realm</SelectItem>
              )}
              {realms?.map((realm) => (
                <SelectItem key={realm.id} value={realm.id}>
                  {realm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <RealmFeed
        realmId={selected === ALL ? null : selected}
        realmSlug={realms?.find((realm) => realm.id === selected)?.slug ?? null}
        compact
      />
      <Link href="/dashboard" className="text-label text-footnote hover:underline">
        Open the feed
      </Link>
    </Card>
  );
}
