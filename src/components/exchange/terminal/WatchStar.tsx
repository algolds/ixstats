"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Star, StarSolid } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import type { WatchKind } from "~/lib/exchange/terminal-valuation";
import { useSignInHref } from "./useSignInHref";

/** Watch or stop watching a company, bond or nation; signed out, a way to sign in. */
export function WatchStar({
  subjectKind,
  subjectId,
  watching,
}: {
  subjectKind: WatchKind;
  subjectId: string;
  watching: boolean;
}) {
  const { isSignedIn } = useAuth();
  const signInHref = useSignInHref();
  const utils = api.useUtils();
  const toggle = api.exchange.toggleWatch.useMutation({
    onSuccess: () => void utils.exchange.invalidate(),
  });
  if (!isSignedIn) {
    return (
      <Button asChild variant="ghost" size="icon-sm">
        <Link href={signInHref} aria-label="Sign in to watch">
          <Star aria-hidden />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={watching ? "Stop watching" : "Watch"}
      aria-pressed={watching}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ subjectKind, subjectId })}
    >
      {watching ? <StarSolid className="text-tint" aria-hidden /> : <Star aria-hidden />}
    </Button>
  );
}
