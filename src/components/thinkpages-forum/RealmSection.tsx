"use client";

import Link from "next/link";
import { skipToken } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { IXWORLD_SLUG } from "~/lib/realms/realm-ids";
import { categoryHref, claimNationHref } from "~/lib/thinkpages-forum/links";
import { noNationNotice } from "~/lib/thinkpages-forum/notices";
import { api, type RouterOutputs } from "~/trpc/react";
import { BanNotice, NoticeText } from "./BanNotice";
import { CategoryRows } from "./CategoryRows";
import { RealmSwitcher } from "./RealmSwitcher";

type Section = RouterOutputs["thinkpagesForum"]["realmSection"];

/**
 * Whether the viewer may post, else the server's reason: a ban as the ban notice, a missing nation with a way to
 * claim one.
 */
function PostingNotice({ section }: { section: Section }) {
  const { notice, realm } = section;
  if (!notice) return <p className="text-footnote text-label-secondary">You can post here</p>;
  if (section.banned) return <BanNotice notice={notice} />;
  return (
    <p className="text-footnote text-label-secondary">
      <span>
        <NoticeText notice={notice} />
      </span>
      {notice === noNationNotice(realm.name) ? (
        <>
          {" "}
          <Link href={claimNationHref(realm.slug)} className="text-tint hover:underline">
            Claim a nation
          </Link>
        </>
      ) : null}
    </p>
  );
}

interface SectionBodyProps {
  section: Section | undefined;
  notFound: boolean;
  onRetry: () => void;
}

function SectionBody({ section, notFound, onRetry }: SectionBodyProps) {
  if (section) {
    return (
      <div className="border-separator border-t">
        <CategoryRows
          categories={section.categories}
          hrefOf={(c) => categoryHref({ key: c.key, realm: section.realm })}
        />
      </div>
    );
  }
  if (notFound) {
    return (
      <p className="text-callout text-label-secondary px-4 pb-4">This realm is not available.</p>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 pb-4">
      <p className="text-callout text-label-secondary">Could not load this realm.</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

interface RealmSectionProps {
  /** The realm's slug; absent, the viewer's default realm (their primary nation's, else IxWorld). */
  realm?: string;
  /** Show the realm switcher (the forum home). */
  switcher?: boolean;
}

/** A realm's forum section: its categories, whether the viewer may post, and optionally the realm switcher. */
export function RealmSection({ realm, switcher = false }: RealmSectionProps) {
  const realms = api.thinkpagesForum.realms.useQuery();
  // Without a realm list (it failed to load) the default is IxWorld, so the section never waits forever.
  const slug = realm ?? realms.data?.defaultSlug ?? (realms.error ? IXWORLD_SLUG : undefined);
  const section = api.thinkpagesForum.realmSection.useQuery(slug ? { realm: slug } : skipToken);

  if (!slug || section.isLoading) return <Skeleton className="rounded-card h-48 w-full" />;

  const listed = realms.data?.realms.find((r) => r.slug === slug);
  const name = section.data?.realm.name ?? listed?.name ?? "Realm";
  // A realm opened by URL may be unlisted (D14); keep it selectable so the trigger shows its name.
  const options =
    realms.data && !listed && section.data
      ? [{ slug, name }, ...realms.data.realms]
      : realms.data?.realms;

  return (
    <Card content="navigation" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-title-3 text-label">{name}</h2>
          {section.data ? <PostingNotice section={section.data} /> : null}
        </div>
        {switcher && options ? <RealmSwitcher realms={options} value={slug} /> : null}
      </div>
      <SectionBody
        section={section.data}
        notFound={section.error?.data?.code === "NOT_FOUND"}
        onRetry={() => void section.refetch()}
      />
    </Card>
  );
}
