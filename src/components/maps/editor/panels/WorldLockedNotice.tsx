"use client";

import Link from "next/link";
import { Signal } from "~/components/ui/signal";
import { realmManageHref } from "~/lib/maps/realm-world-editor";

interface WorldLockedNoticeProps {
  lockReason: "claims" | "archived";
  pendingClaims: number;
  approvedClaims: number;
  realmSlug: string | null;
}

/** Why the world can't be applied right now. A preview can still be made and tuned. */
export function WorldLockedNotice({
  lockReason,
  pendingClaims,
  approvedClaims,
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
      {realmSlug && (
        <p className="mt-1">
          <Link className="text-tint underline" href={realmManageHref(realmSlug, "claims")}>
            Review the realm's claims
          </Link>
        </p>
      )}
    </Signal>
  );
}
