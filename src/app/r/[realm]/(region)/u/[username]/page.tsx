"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, Globe, WarningTriangle as AlertTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { PassportRealmsTab } from "~/components/passport/tabs/PassportRealmsTab";
import { buttonVariants } from "~/components/ui/button";
import { passportSegmentHandleOrRaw } from "~/lib/passport/passport-segment";

const LINK_CLASS = buttonVariants({ variant: "outline", size: "sm" });

/** "{name} (@{handle}) · {realm}", without the realm part until the realm's name has loaded. */
function pageTitle(displayName: string, handle: string, realmName: string): string {
  const person = `${displayName} (@${handle})`;
  return realmName ? `${person} · ${realmName}` : person;
}

/**
 * One identity's memberships inside one realm, served at `/r/{realm}/@{handle}` (a rewrite to this
 * route). The `(region)` layout above supplies the realm header and the 404 for unknown realms; the
 * realm's name comes from its overview, shared with that layout's query. The URL segment only looks
 * the holder up: every displayed handle and link uses the payload's passport handle.
 */
export default function RealmPassportPage({
  params,
}: {
  params: Promise<{ realm: string; username: string }>;
}) {
  const { realm: slug, username } = use(params);
  const segment = passportSegmentHandleOrRaw(username);

  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  const passport = api.ixnayid.getPassport.useQuery({ handle: segment });
  const memberships = api.ixnayid.getRealms.useQuery({ handle: segment, realm: slug });

  const realmName = overview?.realm.name ?? "";
  const account = passport.data?.account;
  const handle = passport.data?.handle ?? segment;
  const displayName = account?.clerkDisplayName || account?.clerkUsername || handle;

  usePageTitle({ title: pageTitle(displayName, handle, realmName) });

  if (passport.isLoading || memberships.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="rounded-card h-24 w-full" />
        <Skeleton className="rounded-sheet h-48 w-full" />
      </div>
    );
  }

  if (!passport.data) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle />}
          title="Identity not found"
          message={`No public passport exists for @${segment}.`}
        />
      </Card>
    );
  }

  const realms = memberships.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card content="entity">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="rounded-card text-title-2 size-14 border">
            <AvatarImage
              src={account?.clerkImageUrl ?? undefined}
              alt={displayName}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback className="rounded-card text-label">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-label text-title-3 truncate">{displayName}</h2>
            <p className="text-label-secondary text-footnote truncate">
              {realmName ? `@${handle} · Realm passport in ${realmName}` : `@${handle}`}
            </p>
          </div>
          <Link href={`/@${encodeURIComponent(handle)}`} className={LINK_CLASS}>
            <span>Full passport</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Card>

      {realms.length > 0 ? (
        <PassportRealmsTab realms={realms} handle={handle} />
      ) : (
        <Card>
          <EmptyState
            icon={<Globe />}
            title="No membership here"
            message={`@${handle} holds no membership or claimed country in ${realmName}.`}
          />
        </Card>
      )}
    </div>
  );
}
