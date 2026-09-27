"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, Globe, WarningTriangle as AlertTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Skeleton } from "~/components/ui/skeleton";
import { PassportRealmsTab } from "~/components/passport/tabs/PassportRealmsTab";

const LINK_CLASS =
  "facet-interactive border-border bg-card text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold active:scale-[0.98]";

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
    memberships.data?.[0]?.name ?? realm.charAt(0).toUpperCase() + realm.slice(1).replace(/-/g, " ");
  const account = passport.data?.account;
  const displayName = account?.clerkDisplayName || account?.clerkUsername || handle;

  usePageTitle({ title: `${displayName} (@${handle}) · ${realmName}` });

  if (passport.isLoading || memberships.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    );
  }

  if (!passport.data) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="border-border bg-card/70 space-y-3 rounded-2xl border p-8 text-center backdrop-blur-xl">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-foreground text-xl font-bold">Identity Not Found</h1>
          <p className="text-muted-foreground text-sm">
            Could not resolve a public passport for @{handle}.
          </p>
        </div>
      </div>
    );
  }

  const realms = memberships.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="border-border bg-card/70 flex flex-col gap-4 rounded-2xl border p-6 shadow-xs backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="bg-accent text-foreground flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border font-mono text-xl font-bold">
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
            <h1 className="text-foreground truncate text-2xl font-bold tracking-tight">
              {displayName}
            </h1>
            <p className="text-muted-foreground font-mono text-xs">
              @{handle} · Realm passport in {realmName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/r/${encodeURIComponent(realm)}`} className={LINK_CLASS}>
            <Globe className="text-muted-foreground h-4 w-4" />
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
        <p className="border-border bg-card/50 text-muted-foreground rounded-2xl border p-8 text-center text-sm">
          @{handle} holds no membership or claimed country in {realmName}.
        </p>
      )}
    </div>
  );
}
