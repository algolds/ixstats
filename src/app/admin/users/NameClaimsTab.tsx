"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { accountLabel, evidenceLine, LinkLegacyNameSheet } from "./LinkLegacyNameSheet";

type ClaimPage = RouterOutputs["admin"]["listNameClaims"];
type QueuedClaim = ClaimPage["items"][number];
type ClaimStatus = QueuedClaim["status"];
type Decision = "approve" | "reject" | "revoke";

const STATUS_OPTIONS: ReadonlyArray<{ value: ClaimStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "REVOKED", label: "Removed" },
];

interface ClaimCardProps {
  claim: QueuedClaim;
  viewerIsSystemOwner: boolean;
  busy: boolean;
  onDecide(decision: Decision, claimId: string, note: string | null): void;
}

/** One claim: who asks, the name's evidence, the player's words and the decision. */
function ClaimCard({ claim, viewerIsSystemOwner, busy, onDecide }: ClaimCardProps) {
  const [note, setNote] = useState("");
  const decidable = claim.status === "PENDING" || claim.status === "APPROVED";
  const groupsStay = claim.evidence.importedGroups.length > 0 && !viewerIsSystemOwner;
  const decide = (decision: Decision) => onDecide(decision, claim.id, note.trim() || null);
  const country = claim.account.countryName;

  return (
    <Card content="data" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-headline text-label">{claim.name}</p>
        <p className="text-callout text-label-secondary">
          {country ? `${accountLabel(claim.account)} · ${country}` : accountLabel(claim.account)}
        </p>
        <p className="text-callout text-label tabular-nums">
          {evidenceLine(claim.evidence, claim.userId)}
        </p>
        {claim.playerEvidence && (
          <p className="text-callout text-label-secondary">{claim.playerEvidence}</p>
        )}
        {claim.decisionNote && (
          <p className="text-footnote text-label-secondary">{claim.decisionNote}</p>
        )}
      </div>
      {groupsStay && decidable && (
        <Signal tone="warning" title="Imported groups stay behind">
          Only a system owner&apos;s approval passes this name&apos;s groups. Its blocks always
          follow the name.
        </Signal>
      )}
      {decidable && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Decision note"
            placeholder="Optional note"
            maxLength={1000}
            disabled={busy}
            className="sm:flex-1"
          />
          {claim.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => decide("approve")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => decide("reject")}
              >
                Reject
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => decide("revoke")}
            >
              Remove
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** The decisions, each refreshing the queue and showing the service's refusal as it is worded. */
function useDecisions() {
  const notify = useNotify();
  const utils = api.useUtils();
  const handlers = {
    onSuccess: () => void utils.admin.listNameClaims.invalidate(),
    onError: (err: { message: string }) => notify.error(err.message),
  };
  const approve = api.admin.approveNameClaim.useMutation(handlers);
  const reject = api.admin.rejectNameClaim.useMutation(handlers);
  const revoke = api.admin.revokeNameClaim.useMutation(handlers);
  const busy = approve.isPending || reject.isPending || revoke.isPending;
  const decide = (decision: Decision, claimId: string, note: string | null) =>
    ({ approve, reject, revoke })[decision].mutate({ claimId, note });
  return { busy, decide };
}

/** Admin: the old IxWiki name claims by status, with each name's evidence, and the direct link sheet. */
export function NameClaimsTab() {
  const [status, setStatus] = useState<ClaimStatus>("PENDING");
  const [linking, setLinking] = useState(false);
  const { busy, decide } = useDecisions();
  const claims = api.admin.listNameClaims.useInfiniteQuery(
    { status, limit: 25 },
    { getNextPageParam: (last) => last.nextCursor }
  );

  const pages = claims.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const viewerIsSystemOwner = pages[0]?.viewerIsSystemOwner ?? false;

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Claim status"
          size="sm"
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS}
        />
        <Button variant="secondary" size="sm" onClick={() => setLinking(true)}>
          Link an old name
        </Button>
      </div>

      {claims.isLoading ? (
        <Skeleton className="rounded-row h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState compact title="No claims here." />
      ) : (
        items.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            viewerIsSystemOwner={viewerIsSystemOwner}
            busy={busy}
            onDecide={decide}
          />
        ))
      )}

      {claims.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          className="self-center"
          disabled={claims.isFetchingNextPage}
          onClick={() => void claims.fetchNextPage()}
        >
          Load more
        </Button>
      )}

      <LinkLegacyNameSheet open={linking} onOpenChange={setLinking} />
    </Card>
  );
}
