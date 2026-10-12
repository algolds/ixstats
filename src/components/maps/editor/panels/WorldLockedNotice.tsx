"use client";

import Link from "next/link";
import { Signal } from "~/components/ui/signal";
import { realmManageHref } from "~/lib/maps/realm-world-editor";

interface WorldLockedNoticeProps {
  lockReason: "claims" | "archived";
  pendingClaims: number;
  approvedClaims: number;
  /** The viewer can open the realm's Claims section (it exists for the founder and the Claims power only) */
  canReviewClaims: boolean;
  realmSlug: string | null;
}

/** Why the world can't be applied right now. A preview can still be made and tuned. */
export function WorldLockedNotice({
  lockReason,
  pendingClaims,
  approvedClaims,
  canReviewClaims,
  realmSlug,
}: WorldLockedNoticeProps) {
  if (lockReason === "archived") {
    return (
      <Signal tone="warning" title="This realm is archived">
        Its world can't be changed. You can still make a preview.
      </Signal>
    );
  }
  return (
    <Signal tone="warning" title="The world is locked">
      <p>
        Claims on this realm's nations: {pendingClaims} pending, {approvedClaims} approved. Using a
        new world would replace nations players have claimed or asked for. You can still make and
        tune a preview.
      </p>
      <p className="mt-1">
        {canReviewClaims && realmSlug ? (
          <Link className="text-tint underline" href={realmManageHref(realmSlug, "claims")}>
            Review the realm's claims
          </Link>
        ) : (
          "The realm's founder and officers with the Claims power review them."
        )}
      </p>
    </Signal>
  );
}

/** The claims that lock the world could not be read, so applying stays off until they can. */
export function WorldLockUnknownNotice() {
  return (
    <Signal tone="warning" title="Claims could not be checked">
      <p>
        Using a world stays off until the realm's claims can be read. You can still make a preview.
      </p>
    </Signal>
  );
}
