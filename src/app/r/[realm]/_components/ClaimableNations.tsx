"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { createUrl } from "~/lib/utils";
import { withVia } from "~/lib/realms/realm-invite";
import { useInviteVia } from "~/components/realms/use-invite-via";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { ClaimStatusBadge, type MyClaim } from "./MyClaims";

interface NationPageItem {
  title: string;
  wikiSource: string;
}

/**
 * Nation pages of the realm's lore index that no country has taken yet; an approved claim creates the country.
 * When the realm has rules, claiming waits for "I have read the realm's rules" (the server checks it too).
 */
export function ClaimableNations({
  realmSlug,
  pages,
  rules = null,
}: {
  realmSlug: string;
  pages: NationPageItem[];
  rules?: { summary: string } | null;
}) {
  const { isSignedIn } = useAuth();
  const notify = useNotify();
  const utils = api.useUtils();
  // An invite link's handle rides along with the claim and through sign-in.
  const via = useInviteVia();
  const [submitted, setSubmitted] = useState<ReadonlySet<string>>(new Set());
  const [acceptedRules, setAcceptedRules] = useState(false);
  const needsRules = !!rules && !acceptedRules;
  const { data: myClaims } = api.realms.myClaims.useQuery({ realmSlug }, { enabled: !!isSignedIn });
  // Newest first: the first claim per page is the one that counts (a rejected claim can be filed again).
  const latestClaim = new Map<string, MyClaim>();
  for (const c of myClaims ?? []) {
    if (c.wikiPageTitle && !latestClaim.has(c.wikiPageTitle)) latestClaim.set(c.wikiPageTitle, c);
  }
  const claim = api.realms.claimNationPage.useMutation({
    onSuccess: (result, { title }) => {
      void utils.realms.myClaims.invalidate();
      if (result.status === "approved") {
        notify.success(`${title} is yours`, "Manage it from MyCountry.");
        void utils.realms.getBySlug.invalidate({ slug: realmSlug });
        void utils.realms.region.invalidate();
        void utils.realms.myNations.invalidate();
        void utils.users.getProfile.invalidate();
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
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(createUrl(withVia(`/r/${realmSlug}`, via)))}`;

  return (
    <section className="border-separator bg-surface rounded-card border p-6">
      <h2 className="text-label text-headline mb-1">Claimable nations · {pages.length}</h2>
      <p className="text-label-secondary text-footnote mb-3">
        {isSignedIn ? (
          "Claim the nation whose wiki page you created."
        ) : (
          <>
            <Link href={signInHref} className="text-tint underline-offset-4 hover:underline">
              Sign in to claim
            </Link>{" "}
            the nation whose wiki page you created.
          </>
        )}
      </p>
      {isSignedIn && rules && (
        <div className="bg-fill-4 rounded-row mb-3 flex flex-col gap-2 p-3">
          <p className="text-label text-footnote font-medium">
            This realm has rules. Read them before you claim a nation.
          </p>
          {rules.summary && (
            <p className="text-label-secondary text-footnote line-clamp-3">{rules.summary}</p>
          )}
          <Link
            href={`/r/${encodeURIComponent(realmSlug)}/rules`}
            className="text-tint text-footnote w-fit underline-offset-4 hover:underline"
          >
            Read the rules
          </Link>
          <label className="text-label text-footnote flex items-center gap-2">
            <Checkbox
              checked={acceptedRules}
              onCheckedChange={(checked) => setAcceptedRules(checked === true)}
            />
            I have read the realm&apos;s rules
          </label>
        </div>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const mine = latestClaim.get(page.title);
          const isPending = submitted.has(page.title) || mine?.status === "pending";
          const rejected = !isPending && mine?.status === "rejected" ? mine : null;
          return (
            <li key={page.title} className="hover:bg-fill-3 rounded-row flex flex-col gap-1 p-2">
              <div className="flex items-center gap-2">
                <Link
                  href={wikiReaderPath(page.title, parseWikiSource(page.wikiSource))}
                  className="text-label text-body truncate hover:underline"
                >
                  {page.title}
                </Link>
                {rejected && <ClaimStatusBadge status="rejected" />}
                {isSignedIn && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="ml-auto"
                    aria-label={`Claim ${page.title}`}
                    disabled={claim.isPending || isPending || needsRules}
                    onClick={() =>
                      claim.mutate({
                        realmSlug,
                        title: page.title,
                        ...(rules && { acceptedRules }),
                        ...(via && { via }),
                      })
                    }
                  >
                    {isPending ? "Pending review" : rejected ? "Claim again" : "Claim"}
                  </Button>
                )}
              </div>
              {rejected?.rejectionReason && (
                <p className="text-label-secondary text-footnote">
                  Your claim was rejected: {rejected.rejectionReason}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
