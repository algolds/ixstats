"use client";

import React from "react";
import Link from "next/link";
import { withVia } from "~/lib/realms/realm-invite";
import { buttonVariants } from "~/components/ui/button";

interface PassportVisitorFooterProps {
  /** Only signed-out visitors see the footer. */
  signedOut: boolean;
  /** The holder's canonical handle: the invite's `via`. */
  handle: string;
  /** The realm of the holder's primary nation; no Join link without one. */
  realm: { name: string; slug: string } | null;
}

/** Under a passport, for signed-out visitors: sign up for a passport, or join the holder's realm by invite. */
export const PassportVisitorFooter = React.memo(function PassportVisitorFooter({
  signedOut,
  handle,
  realm,
}: PassportVisitorFooterProps) {
  if (!signedOut) return null;
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
        Get your own passport
      </Link>
      {realm && (
        <Link
          href={withVia(`/r/${encodeURIComponent(realm.slug)}`, handle)}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Join {realm.name}
        </Link>
      )}
    </footer>
  );
});
