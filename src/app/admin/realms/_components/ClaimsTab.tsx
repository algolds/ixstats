"use client";
import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function ClaimsTab() {
  const utils = api.useUtils();
  const notify = useNotify();
  const { data: claims, isLoading } = api.realms.listClaims.useQuery({ status: "pending" });
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
    onSettled: () => void utils.realms.listClaims.invalidate(),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading claims…</p>;
  if (!claims?.length) return <p className="text-muted-foreground text-sm">No pending claims.</p>;

  return (
    <ul className="divide-border/40 divide-y">
      {claims.map((claim) => (
        <li
          key={claim.id}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-foreground text-sm font-semibold">
              {claim.country?.name ?? "Unknown nation"}{" "}
              <span className="text-muted-foreground">· {claim.realm.name}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              Claimed by {claim.user.wikiUsername ?? claim.user.clerkUserId} on{" "}
              {new Date(claim.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={reasons[claim.id] ?? ""}
              onChange={(e) => setReasons((r) => ({ ...r, [claim.id]: e.target.value }))}
              placeholder="Reason (required to reject)"
              className="h-8 w-56 text-xs"
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
