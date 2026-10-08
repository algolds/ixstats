"use client";

import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";

export type MyClaim = RouterOutputs["realms"]["myClaims"][number];

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "default" },
};

/** A claim's status chip: pending, approved or rejected. */
export function ClaimStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const claimName = (claim: MyClaim) => claim.country?.name ?? claim.wikiPageTitle ?? "A nation";

/** The signed-in player's claims, in one realm (`realmSlug`) or all, with each status and rejection reason. */
export function MyClaims({ realmSlug }: { realmSlug?: string }) {
  const { isSignedIn } = useAuth();
  const { data: claims } = api.realms.myClaims.useQuery(realmSlug ? { realmSlug } : undefined, {
    enabled: !!isSignedIn,
  });
  if (!isSignedIn || !claims?.length) return null;

  return (
    <section
      className="border-separator bg-surface rounded-card border p-4 md:p-6"
      aria-labelledby="my-claims-heading"
    >
      <h2 id="my-claims-heading" className="text-label text-headline mb-3">
        Your claims · {claims.length}
      </h2>
      <ul className="divide-separator flex flex-col divide-y">
        {claims.map((claim) => (
          <li key={claim.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              {claim.country ? (
                <Link
                  href={`/countries/${claim.country.slug ?? claim.country.id}`}
                  className="text-label text-body font-medium hover:underline"
                >
                  {claimName(claim)}
                </Link>
              ) : (
                <span className="text-label text-body font-medium">{claimName(claim)}</span>
              )}
              {!realmSlug && (
                <Link
                  href={`/r/${encodeURIComponent(claim.realm.slug)}`}
                  className="text-label-secondary text-footnote hover:underline"
                >
                  {claim.realm.name}
                </Link>
              )}
              <ClaimStatusBadge status={claim.status} />
              <span className="text-label-secondary text-footnote ml-auto">
                {claim.reviewedAt
                  ? `decided ${timeAgo(claim.reviewedAt)}`
                  : `filed ${timeAgo(claim.createdAt)}`}
              </span>
            </div>
            {claim.status === "rejected" && claim.rejectionReason && (
              <p className="text-label-secondary text-footnote">Reason: {claim.rejectionReason}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
