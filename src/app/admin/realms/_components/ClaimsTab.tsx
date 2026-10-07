"use client";
import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { parseWikiSource, publicArticleUrl } from "~/lib/wiki-os/config";

type Claim = RouterOutputs["realms"]["listClaims"][number];
type Claimant = Claim["user"];

const WIKI_LABELS: Record<string, string> = {
  ixwiki: "IxWiki",
  iiwiki: "IIWiki",
  althistory: "AltHistory",
};

/** Verified wiki accounts identify the claimant; the legacy wikiUsername was never proven, so it is labelled. */
function ClaimantName({ user }: { user: Claimant }) {
  if (user.wikiAccountLinks.length > 0) {
    return (
      <span className="text-label">
        {user.wikiAccountLinks
          .map((link) => `${WIKI_LABELS[link.source] ?? link.source}: ${link.username} ✓`)
          .join(", ")}
      </span>
    );
  }
  if (user.wikiUsername) {
    return (
      <span>
        {user.wikiUsername} <span className="text-yellow">(unverified)</span>
      </span>
    );
  }
  return <span className="font-mono">{user.clerkUserId}</span>;
}

/** A claim on an existing country names the country; a nation-page claim names the page its approval turns into a country. */
function ClaimedNation({ claim }: { claim: Claim }) {
  if (claim.country) return <>{claim.country.name}</>;
  if (!claim.wikiPageTitle) return <>Unknown nation</>;
  const wiki = WIKI_LABELS[claim.wikiSource ?? ""] ?? claim.wikiSource;
  return (
    <>
      {claim.wikiPageTitle}{" "}
      <span className="text-label-secondary text-footnote font-normal">
        (new nation from {wiki})
      </span>
    </>
  );
}

/** The claimed page's history on its own wiki: who created it (and so who may claim it) is its first entry. */
function PageHistoryLink({ claim }: { claim: Claim }) {
  if (claim.country || !claim.wikiPageTitle) return null;
  const href = `${publicArticleUrl(claim.wikiPageTitle, parseWikiSource(claim.wikiSource))}?action=history`;
  return (
    <>
      {" · "}
      <a href={href} target="_blank" rel="noreferrer" className="text-tint hover:underline">
        Page history
      </a>
    </>
  );
}

/** Pending claims the caller may review; `realmId` narrows them to one realm (a founder's Manage tab). */
export function ClaimsTab({ realmId }: { realmId?: string } = {}) {
  const utils = api.useUtils();
  const notify = useNotify();
  const { data: allClaims, isLoading } = api.realms.listClaims.useQuery({ status: "pending" });
  const claims = realmId ? allClaims?.filter((claim) => claim.realm.id === realmId) : allClaims;
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const review = api.realms.reviewClaim.useMutation({
    onSuccess: (result, input) => {
      if (input.approve && result.status === "rejected") {
        notify.warning(
          "Claim auto-rejected",
          "The nation was taken or the player reached their nation cap first."
        );
      }
    },
    onError: (error) => notify.error("Review failed", error.message),
    onSettled: () => {
      void utils.realms.listClaims.invalidate();
      void utils.realms.region.invalidate();
    },
  });

  if (isLoading) return <p className="text-label-secondary text-body">Loading claims…</p>;
  if (!claims?.length) return <p className="text-label-secondary text-body">No pending claims.</p>;

  return (
    <ul className="divide-separator divide-y">
      {claims.map((claim) => (
        <li
          key={claim.id}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-label text-headline">
              <ClaimedNation claim={claim} />{" "}
              <span className="text-label-secondary">· {claim.realm.name}</span>
            </p>
            <p className="text-label-secondary text-footnote">
              Claimed by <ClaimantName user={claim.user} /> on{" "}
              {new Date(claim.createdAt).toLocaleDateString()}
              <PageHistoryLink claim={claim} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={reasons[claim.id] ?? ""}
              onChange={(e) => setReasons((r) => ({ ...r, [claim.id]: e.target.value }))}
              placeholder="Reason (required to reject)"
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-56"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() =>
                review.mutate({ claimId: claim.id, approve: false, reason: reasons[claim.id] })
              }
            >
              Reject
            </Button>
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ claimId: claim.id, approve: true })}
            >
              Approve
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
