"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/utils";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";

export interface NationPageItem {
  title: string;
  wikiSource: string;
}

/** Nation pages of the realm's lore index that no country has taken yet; an approved claim creates the country. */
export function ClaimableNations({
  realmSlug,
  pages,
}: {
  realmSlug: string;
  pages: NationPageItem[];
}) {
  const { isSignedIn } = useAuth();
  const notify = useNotify();
  const utils = api.useUtils();
  const [submitted, setSubmitted] = useState<ReadonlySet<string>>(new Set());
  const claim = api.realms.claimNationPage.useMutation({
    onSuccess: (result, { title }) => {
      if (result.status === "approved") {
        notify.success(`${title} is yours`, "Manage it from MyCountry.");
        void utils.realms.getBySlug.invalidate({ slug: realmSlug });
        return;
      }
      setSubmitted((titles) => new Set(titles).add(title));
      notify.info(
        "Claim submitted",
        "A moderator will review it; verify your wiki account in Settings to be approved instantly."
      );
    },
    onError: (error) => notify.error("Claim failed", error.message),
  });
  const signInHref = createUrl(
    `/sign-in?redirect_url=${encodeURIComponent(createUrl(`/r/${realmSlug}`))}`
  );

  return (
    <section className="border-border bg-card/70 rounded-2xl border p-6">
      <h2 className="text-foreground mb-1 text-sm font-bold">Claimable nations · {pages.length}</h2>
      <p className="text-muted-foreground mb-3 text-xs">
        {isSignedIn ? (
          "Claim the nation whose wiki page you created."
        ) : (
          <>
            <Link href={signInHref} className="text-primary underline-offset-4 hover:underline">
              Sign in to claim
            </Link>{" "}
            the nation whose wiki page you created.
          </>
        )}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const isSubmitted = submitted.has(page.title);
          return (
            <li key={page.title} className="hover:bg-muted flex items-center gap-2 rounded-xl p-2">
              <Link
                href={createUrl(wikiReaderPath(page.title, parseWikiSource(page.wikiSource)))}
                className="text-foreground truncate text-sm hover:underline"
              >
                {page.title}
              </Link>
              {isSignedIn && (
                <Button
                  size="xs"
                  variant="outline"
                  className="ml-auto"
                  aria-label={`Claim ${page.title}`}
                  disabled={claim.isPending || isSubmitted}
                  onClick={() => claim.mutate({ realmSlug, title: page.title })}
                >
                  {isSubmitted ? "Pending review" : "Claim"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
