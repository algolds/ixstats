"use client";

import Link from "next/link";
import { useAuth } from "~/context/auth-context";
import { createUrl } from "~/lib/utils";
import { withVia } from "~/lib/realms/realm-invite";
import { buttonVariants } from "~/components/ui/button";
import { useRealmInviter } from "~/components/realms/use-invite-via";

/**
 * The realm's Join panel for an invite link (`/r/{slug}?via={handle}`): "@handle invited you", shown only when
 * the handle names a player holding a nation in this realm. The invite rides on to the nations list (where
 * claims carry it) and through sign-in.
 */
export function RealmInvitePanel({
  realmSlug,
  realmName,
}: {
  realmSlug: string;
  realmName: string;
}) {
  const { via, inviter } = useRealmInviter(realmSlug);
  const { isSignedIn } = useAuth();
  if (!via || !inviter) return null;

  const base = `/r/${encodeURIComponent(realmSlug)}`;
  const href = isSignedIn
    ? withVia(`${base}/nations`, via)
    : `/sign-in?redirect_url=${encodeURIComponent(createUrl(withVia(base, via)))}`;
  return (
    <section
      className="border-separator bg-surface rounded-card border p-4 md:p-6"
      aria-label={`Join ${realmName}`}
    >
      <h2 className="text-label text-headline">Join {realmName}</h2>
      <p className="text-label-secondary text-body mt-1">
        <Link
          href={`/@${encodeURIComponent(inviter.handle)}`}
          title={inviter.displayName}
          className="text-label font-medium hover:underline"
        >
          @{inviter.handle}
        </Link>{" "}
        invited you
      </p>
      <Link href={href} className={buttonVariants({ size: "sm", className: "mt-3" })}>
        {isSignedIn ? "Find a nation to claim" : "Sign in to claim a nation"}
      </Link>
    </section>
  );
}
