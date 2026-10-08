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
import { PageHeader } from "~/components/shell/PageHeader";

const LINK_CLASS = buttonVariants({ variant: "outline", size: "sm" });

/** One identity's memberships inside one realm. */
export default function RealmPassportPage({
  params,
}: {
  params: Promise<{ realm: string; username: string }>;
}) {
  const { realm: rawRealm, username } = use(params);
  const realm = decodeURIComponent(rawRealm);
  const handle = decodeURIComponent(username).replace(/^@/, "");

  const passport = api.ixnayid.getPassport.useQuery({ handle });
  const memberships = api.ixnayid.getRealms.useQuery({ handle, realm });

  const realmName =
    memberships.data?.[0]?.name ??
    realm.charAt(0).toUpperCase() + realm.slice(1).replace(/-/g, " ");
  const account = passport.data?.account;
  const displayName = account?.clerkDisplayName || account?.clerkUsername || handle;

  usePageTitle({ title: `${displayName} (@${handle}) · ${realmName}` });

  if (passport.isLoading || memberships.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Skeleton className="rounded-card h-28 w-full" />
        <Skeleton className="rounded-sheet h-48 w-full" />
      </div>
    );
  }

  if (!passport.data) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <Card>
          <EmptyState
            icon={<AlertTriangle />}
            title="Identity not found"
            message={`No public passport exists for @${handle}.`}
          />
        </Card>
      </div>
    );
  }

  const realms = memberships.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title={displayName}
        subtitle={`@${handle} · Realm passport in ${realmName}`}
        leading={
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
        }
        actions={
          <>
            <Link href={`/r/${encodeURIComponent(realm)}`} className={LINK_CLASS}>
              <Globe className="text-label-secondary size-4" />
              <span>{realmName}</span>
            </Link>
            <Link href={`/@${encodeURIComponent(handle)}`} className={LINK_CLASS}>
              <span>Full passport</span>
              <ArrowRight className="size-4" />
            </Link>
          </>
        }
      />

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
