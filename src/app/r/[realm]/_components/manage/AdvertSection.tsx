"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { newAdvertHref, threadHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { ManageSection } from "./ManageSection";

const DESCRIPTION =
  "Your realm's advert in Find a Realm: one thread, headed by a live card with Join. The founder and officers with the Appearance power manage it.";

/**
 * The realm's Find a Realm advert: a link to it, or Create advert. The advert is one thread headed by a live card with
 * Join; the founder and officers with the Appearance power manage it. The read goes through the forum router, because
 * the realms module does not import the forum.
 */
export function AdvertSection({
  slug,
  realmId,
  archived,
}: {
  slug: string;
  realmId: string;
  archived: boolean;
}) {
  return (
    <ManageSection id="advert" title="Advert" description={DESCRIPTION}>
      {realmId === DEFAULT_REALM_ID ? (
        <p className="text-label-secondary text-footnote">
          IxWorld cannot be advertised in Find a Realm.
        </p>
      ) : (
        <AdvertState slug={slug} archived={archived} />
      )}
    </ManageSection>
  );
}

function AdvertState({ slug, archived }: { slug: string; archived: boolean }) {
  const { data, isLoading } = api.thinkpagesForum.advertFor.useQuery(
    { realm: slug },
    { retry: false }
  );
  return isLoading ? (
    <p className="text-label-secondary text-footnote">Loading…</p>
  ) : data?.hiddenByModerator ? (
    <p className="text-label-secondary text-footnote">Your advert was hidden by a moderator.</p>
  ) : data?.threadId ? (
    <Button asChild size="sm" className="pointer-coarse:min-h-11">
      <Link href={threadHref(data.threadId)}>Open the advert</Link>
    </Button>
  ) : archived ? (
    <p className="text-label-secondary text-footnote">An archived realm cannot be advertised.</p>
  ) : data ? (
    <Button asChild size="sm" className="pointer-coarse:min-h-11">
      <Link href={newAdvertHref(slug)}>Create advert</Link>
    </Button>
  ) : (
    <p className="text-label-secondary text-footnote">The advert could not be loaded.</p>
  );
}
