"use client";

import React from "react";
import {
  MailIn,
  SendDiagonal,
  Check,
  Xmark,
  Undo,
  Clock,
  WarningTriangle,
  Refresh,
  Group as Users,
  Community as Handshake,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { FP_PROPOSAL_LABELS, INBOX_QUERY_OPTIONS, formatExpiry } from "./useDiplomacyInbox";
import { Skeleton } from "~/components/ui/skeleton";

interface DiplomacyInboxProps {
  countryId: string;
}

interface InboxRow {
  key: string;
  kind: "proposal" | "invite";
  title: string;
  subtitle: string;
  expiresAt: Date | string;
}

/**
 * Diplomacy inbox: incoming cooperative foreign-policy proposals and alliance invites the
 * country can accept or decline, and the country's own pending outgoing ones, which it can
 * withdraw. Pending items expire 14 days after they are issued (server-enforced).
 */
export function DiplomacyInbox({ countryId }: DiplomacyInboxProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const input = { countryId };
  const opts = { ...INBOX_QUERY_OPTIONS, enabled: !!countryId };

  const incomingProposals = api.diplomaticPolicies.getForeignPolicyProposals.useQuery(input, opts);
  const incomingInvites = api.diplomaticPolicies.getAllianceInvites.useQuery(input, opts);
  const outgoingProposals = api.diplomaticPolicies.getOutgoingForeignPolicyProposals.useQuery(
    input,
    opts
  );
  const outgoingInvites = api.diplomaticPolicies.getOutgoingAllianceInvites.useQuery(input, opts);

  const refresh = () => {
    void utils.diplomaticPolicies.getForeignPolicyProposals.invalidate();
    void utils.diplomaticPolicies.getAllianceInvites.invalidate();
    void utils.diplomaticPolicies.getOutgoingForeignPolicyProposals.invalidate();
    void utils.diplomaticPolicies.getOutgoingAllianceInvites.invalidate();
    void utils.diplomaticPolicies.getAlliances.invalidate();
    void utils.diplomaticPolicies.getActiveForeignPolicies.invalidate();
  };
  const onError = (title: string) => (err: { message: string }) => {
    notify.error(title, err.message);
    refresh();
  };

  const respondProposal = api.diplomaticPolicies.respondToForeignPolicyProposal.useMutation({
    onSuccess: (res) => {
      if (res.status === "active")
        notify.success("Proposal accepted", "The agreement is now in effect.");
      else notify.success("Proposal declined");
      refresh();
    },
    onError: onError("Could not answer the proposal"),
  });
  const respondInvite = api.diplomaticPolicies.respondToAllianceInvite.useMutation({
    onSuccess: (res) => {
      if (res.status === "active")
        notify.success("Invitation accepted", "You joined the alliance.");
      else notify.success("Invitation declined");
      refresh();
    },
    onError: onError("Could not answer the invitation"),
  });
  const withdrawProposal = api.diplomaticPolicies.withdrawForeignPolicyProposal.useMutation({
    onSuccess: () => {
      notify.success("Proposal withdrawn");
      refresh();
    },
    onError: onError("Could not withdraw the proposal"),
  });
  const withdrawInvite = api.diplomaticPolicies.withdrawAllianceInvite.useMutation({
    onSuccess: () => {
      notify.success("Invitation withdrawn");
      refresh();
    },
    onError: onError("Could not withdraw the invitation"),
  });

  const busy =
    respondProposal.isPending ||
    respondInvite.isPending ||
    withdrawProposal.isPending ||
    withdrawInvite.isPending;

  const incoming: (InboxRow & { onAccept: () => void; onDecline: () => void })[] = [
    ...(incomingProposals.data ?? []).map((p) => ({
      key: `fp-${p.id}`,
      kind: "proposal" as const,
      title: FP_PROPOSAL_LABELS[p.actionType] ?? p.actionType,
      subtitle: `Proposed by ${p.initiator?.name ?? "another nation"}`,
      expiresAt: p.expiresAt,
      onAccept: () => respondProposal.mutate({ actionId: p.id, choice: "accept" }),
      onDecline: () => respondProposal.mutate({ actionId: p.id, choice: "decline" }),
    })),
    ...(incomingInvites.data ?? []).map((i) => ({
      key: `inv-${i.allianceId}`,
      kind: "invite" as const,
      title: `Join ${i.alliance?.name ?? "an alliance"}`,
      subtitle: [
        i.invitedBy ? `Invited by ${i.invitedBy.name}` : "Alliance invitation",
        i.role === "observer" ? "as observer" : null,
      ]
        .filter(Boolean)
        .join(" "),
      expiresAt: i.expiresAt,
      onAccept: () =>
        respondInvite.mutate({ allianceId: i.allianceId, countryId, choice: "accept" }),
      onDecline: () =>
        respondInvite.mutate({ allianceId: i.allianceId, countryId, choice: "decline" }),
    })),
  ];

  const outgoing: (InboxRow & { onWithdraw: () => void })[] = [
    ...(outgoingProposals.data ?? []).map((p) => ({
      key: `fp-${p.id}`,
      kind: "proposal" as const,
      title: FP_PROPOSAL_LABELS[p.actionType] ?? p.actionType,
      subtitle: `To ${p.target?.name ?? "another nation"}`,
      expiresAt: p.expiresAt,
      onWithdraw: () => withdrawProposal.mutate({ actionId: p.id }),
    })),
    ...(outgoingInvites.data ?? []).map((i) => ({
      key: `inv-${i.allianceId}-${i.countryId}`,
      kind: "invite" as const,
      title: `${i.country?.name ?? "A nation"} → ${i.alliance?.name ?? "alliance"}`,
      subtitle: i.role === "observer" ? "Alliance invitation (observer)" : "Alliance invitation",
      expiresAt: i.expiresAt,
      onWithdraw: () => withdrawInvite.mutate({ allianceId: i.allianceId, countryId: i.countryId }),
    })),
  ];

  const incomingLoading = incomingProposals.isLoading || incomingInvites.isLoading;
  const incomingError = incomingProposals.error ?? incomingInvites.error;
  const outgoingLoading = outgoingProposals.isLoading || outgoingInvites.isLoading;
  const outgoingError = outgoingProposals.error ?? outgoingInvites.error;

  return (
    <div className="space-y-5">
      <InboxSection
        icon={MailIn}
        title="Incoming"
        description="Proposals and invitations awaiting your answer."
        loading={incomingLoading}
        error={incomingError?.message}
        onRetry={() => {
          void incomingProposals.refetch();
          void incomingInvites.refetch();
        }}
        emptyText="Nothing awaiting your answer. Free trade and military alliance proposals and alliance invitations from other nations will appear here."
        count={incoming.length}
      >
        {incoming.map((row) => (
          <InboxItem key={row.key} row={row} status="Awaiting your answer">
            <Button
              size="sm"
              className="gap-1"
              disabled={busy}
              onClick={row.onAccept}
              aria-label={`Accept: ${row.title}`}
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={busy}
              onClick={row.onDecline}
              aria-label={`Decline: ${row.title}`}
            >
              <Xmark className="h-3.5 w-3.5" />
              Decline
            </Button>
          </InboxItem>
        ))}
      </InboxSection>

      <InboxSection
        icon={SendDiagonal}
        title="Outgoing"
        description="Your pending proposals and invitations. You will be notified when they are answered."
        loading={outgoingLoading}
        error={outgoingError?.message}
        onRetry={() => {
          void outgoingProposals.refetch();
          void outgoingInvites.refetch();
        }}
        emptyText="No pending proposals or invitations. Propose free trade or a military alliance from another nation's profile, or invite nations to an alliance you lead."
        count={outgoing.length}
      >
        {outgoing.map((row) => (
          <InboxItem key={row.key} row={row} status="Pending">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={busy}
              onClick={row.onWithdraw}
              aria-label={`Withdraw: ${row.title}`}
            >
              <Undo className="h-3.5 w-3.5" />
              Withdraw
            </Button>
          </InboxItem>
        ))}
      </InboxSection>
    </div>
  );
}

function InboxSection({
  icon: Icon,
  title,
  description,
  loading,
  error,
  onRetry,
  emptyText,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  emptyText: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2" aria-label={title}>
      <div className="flex items-center gap-2">
        <Icon className="text-label-secondary h-4 w-4" />
        <h4 className="text-label text-headline">{title}</h4>
        {!loading && !error && (
          <span className="text-label-secondary text-footnote tabular-nums">{count}</span>
        )}
      </div>
      <p className="text-label-secondary text-footnote">{description}</p>
      {loading ? (
        <div className="space-y-2" role="status" aria-label={`Loading ${title.toLowerCase()}`}>
          <Skeleton className="rounded-row h-16" />
          <Skeleton className="rounded-row h-16" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 rounded-row text-body flex flex-wrap items-center justify-between gap-3 border p-3"
        >
          <span className="text-destructive flex items-center gap-2">
            <WarningTriangle className="h-4 w-4 shrink-0" />
            Could not load {title.toLowerCase()} items: {error}
          </span>
          <Button size="sm" variant="outline" className="gap-1" onClick={onRetry}>
            <Refresh className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : count === 0 ? (
        <div className="border-separator text-label-secondary rounded-row text-body border border-dashed p-5 text-center">
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function InboxItem({
  row,
  status,
  children,
}: {
  row: InboxRow;
  status: string;
  children: React.ReactNode;
}) {
  const KindIcon = row.kind === "invite" ? Users : Handshake;
  return (
    <li className="border-separator bg-surface rounded-row flex flex-wrap items-center justify-between gap-3 border p-3">
      <div className="flex min-w-0 items-start gap-3">
        <KindIcon className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-label text-headline truncate">{row.title}</p>
          <p className="text-label-secondary text-footnote truncate">{row.subtitle}</p>
          <p className="text-label-secondary text-footnote mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {status} · {formatExpiry(row.expiresAt)}
            </span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}
