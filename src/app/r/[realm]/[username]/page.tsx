"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, Globe, WarningTriangle as AlertTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Skeleton } from "~/components/ui/skeleton";
import { PassportRealmsTab } from "~/components/passport/tabs/PassportRealmsTab";
import { buttonVariants } from "~/components/ui/button";

const LINK_CLASS = buttonVariants({ variant: "outline", size: "sm" });

/** Contextual passport (plan 188 §3): one identity's memberships inside one realm. */
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
        <div className="border-separator bg-surface rounded-card space-y-3 border p-8 text-center">
          <AlertTriangle className="text-yellow mx-auto h-10 w-10" />
          <h1 className="text-label text-title-2">Identity Not Found</h1>
          <p className="text-label-secondary text-body">
            Could not resolve a public passport for @{handle}.
          </p>
        </div>
      </div>
    );
  }

  const realms = memberships.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="material-hero text-label flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="bg-fill-3 text-label rounded-card text-title-2 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border font-mono">
            {account?.clerkImageUrl ? (
              <img
                src={account.clerkImageUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-label text-title-1 truncate">{displayName}</h1>
            <p className="text-label-secondary text-footnote font-mono">
              @{handle} · Realm passport in {realmName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/r/${encodeURIComponent(realm)}`} className={LINK_CLASS}>
            <Globe className="text-label-secondary h-4 w-4" />
            <span>{realmName}</span>
          </Link>
          <Link href={`/@${encodeURIComponent(handle)}`} className={LINK_CLASS}>
            <span>Full Passport</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {realms.length > 0 ? (
        <PassportRealmsTab realms={realms} cleanUsername={handle} />
      ) : (
        <p className="border-separator bg-surface text-label-secondary rounded-card text-body border p-8 text-center">
          @{handle} holds no membership or claimed country in {realmName}.
        </p>
      )}
    </div>
  );
}
