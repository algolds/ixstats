"use client";

import { useState } from "react";
import { Group } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import {
  CompanySelect,
  StatusBadge,
  formatSovereigns,
  parseAmount,
  useRequestId,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Proposal = RouterOutputs["exchange"]["listProposals"][number];
type AcquisitionOffer = RouterOutputs["exchange"]["getAcquisitionOffers"][number];
type OwnerProposalKind = "ISSUE_SHARES" | "DISSOLVE";

const PROPOSAL_TITLE: Record<string, string> = {
  ISSUE_SHARES: "Share issue proposal",
  DISSOLVE: "Liquidation proposal",
  ACQUIRE_OFFER: "Acquisition buyout offer",
};

function describeProposalPayload(p: Proposal, companyNames: ReadonlyMap<string, string>): string {
  const record = (p.payload ?? {}) as Record<string, number | string | undefined>;
  if (p.type === "ISSUE_SHARES") {
    const shares = Number(record.shares ?? 0);
    return `Issue ${shares.toLocaleString("en-US")} new primary shares at fair value`;
  }
  if (p.type === "ACQUIRE_OFFER") {
    const offerAmount = Number(record.offerAmount ?? 0);
    const buyerId = String(record.buyerCompanyId ?? "");
    const buyerName = companyNames.get(buyerId) ?? "Acquiring company";
    return `Buyout offer of ${formatSovereigns(offerAmount)} from ${buyerName}`;
  }
  return "Wind down the company and distribute remaining liquid capital pro rata to shareholders";
}

function OpenProposalForm({
  companyId,
  companyName,
  onDone,
}: {
  companyId: string;
  companyName: string;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [form, setForm] = useState({
    type: "ISSUE_SHARES" as OwnerProposalKind,
    rawShares: "",
  });
  const [requestId, rotate] = useRequestId();
  const shares = parseAmount(form.rawShares);
  const ready = form.type === "DISSOLVE" || !Number.isNaN(shares);

  const open = api.exchange.openProposal.useMutation({
    onSuccess: ({ proposal }) => {
      notify.success(
        proposal.status === "PASSED" ? "Proposal passed immediately" : "Proposal opened for voting"
      );
      setForm((prev) => ({ ...prev, rawShares: "" }));
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not open proposal", e.message),
  });

  return (
    <div className="border-separator space-y-3 border-t pt-4">
      <p className="text-footnote text-label font-medium">
        Open a shareholder proposal for {companyName}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <SegmentedControl
          aria-label="Proposal kind"
          size="sm"
          value={form.type}
          onValueChange={(v) => setForm({ ...form, type: v as OwnerProposalKind })}
          options={[
            { value: "ISSUE_SHARES", label: "Issue shares" },
            { value: "DISSOLVE", label: "Liquidate" },
          ]}
        />
        {form.type === "ISSUE_SHARES" && (
          <div className="w-32">
            <Input
              aria-label={`New shares for ${companyName}`}
              inputMode="numeric"
              value={form.rawShares}
              onChange={(e) =>
                setForm({ ...form, rawShares: e.target.value.replace(/[^0-9]/g, "") })
              }
              placeholder="Shares"
            />
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={open.isPending || !ready}
          onClick={() =>
            open.mutate({
              companyId,
              type: form.type,
              shares: form.type === "ISSUE_SHARES" ? shares : undefined,
              requestId,
            })
          }
        >
          {open.isPending ? "Opening..." : "Open proposal"}
        </Button>
      </div>
      <p className="text-caption text-label-secondary">
        Passes as soon as more than 50% of outstanding shares vote in favor (executes immediately
        when you hold a majority). Voting stays open for 3 days.
      </p>
    </div>
  );
}

function OfferBanner({
  offers,
  companyNames,
  isOpen,
  onVote,
  voting,
}: {
  offers: ReadonlyArray<AcquisitionOffer>;
  companyNames: ReadonlyMap<string, string>;
  isOpen: boolean;
  onVote: (proposalId: string, support: boolean) => void;
  voting: boolean;
}) {
  if (offers.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-footnote text-label font-medium">
        Open acquisition offers ({offers.length})
      </p>
      {offers.map((o) => {
        const buyerName = companyNames.get(o.offer.buyerCompanyId) ?? "Acquiring company";
        const pctFor =
          o.totalEligibleShares > 0
            ? Math.round((o.sharesFor / o.totalEligibleShares) * 1000) / 10
            : 0;
        const pctAgainst =
          o.totalEligibleShares > 0
            ? Math.round((o.sharesAgainst / o.totalEligibleShares) * 1000) / 10
            : 0;
        return (
          <div
            key={o.id}
            className="border-separator bg-fill-3 rounded-control space-y-2 border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-footnote text-label font-medium tabular-nums">
                Buyout offer of {formatSovereigns(o.offer.offerAmount)} from {buyerName}
              </p>
              <Badge variant="info">Acquisition offer</Badge>
            </div>
            <p className="text-caption text-label-secondary tabular-nums">
              For: {o.sharesFor.toLocaleString("en-US")} shares ({pctFor}%) · Against:{" "}
              {o.sharesAgainst.toLocaleString("en-US")} shares ({pctAgainst}%) · Eligible:{" "}
              {o.totalEligibleShares.toLocaleString("en-US")} shares · Closes{" "}
              {new Date(o.expiresIxTime).toLocaleDateString()}
            </p>
            {isOpen && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="xs"
                  disabled={voting}
                  onClick={() => onVote(o.id, true)}
                >
                  Approve buyout
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={voting}
                  onClick={() => onVote(o.id, false)}
                >
                  Reject buyout
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Shareholder proposals, voting and M&A buyout offers for a company. */
export function GovernanceCard({
  overview,
  directoryCompanies = [],
  selectedCompanyId,
  onSelectCompany,
  onChanged,
}: {
  overview: Overview;
  directoryCompanies?: ReadonlyArray<{ id: string; name: string }>;
  selectedCompanyId?: string;
  onSelectCompany?: (companyId: string) => void;
  onChanged: () => void;
}) {
  const notify = useNotify();
  const [localCompanyId, setLocalCompanyId] = useState("");

  const allCompanies = [
    ...overview.companies.map((c) => ({ id: c.id, name: c.name })),
    ...directoryCompanies.filter((d) => !overview.companies.some((c) => c.id === d.id)),
  ];
  const companyNames = new Map(allCompanies.map((c) => [c.id, c.name]));
  const companyId = selectedCompanyId || localCompanyId || allCompanies[0]?.id || "";
  const ownedCompany = overview.companies.find((c) => c.id === companyId);

  const proposals = api.exchange.listProposals.useQuery(
    { companyId },
    { enabled: Boolean(companyId) }
  );
  const offers = api.exchange.getAcquisitionOffers.useQuery(
    { companyId },
    { enabled: Boolean(companyId) }
  );

  const refresh = () => {
    void proposals.refetch();
    void offers.refetch();
    onChanged();
  };

  const vote = api.exchange.castVote.useMutation({
    onSuccess: ({ proposal }) => {
      notify.success(
        proposal.status === "OPEN" ? "Ballot recorded" : `Proposal ${proposal.status.toLowerCase()}`
      );
      refresh();
    },
    onError: (e) => notify.error("Could not cast vote", e.message),
  });

  const handleSelectCompany = (id: string) => {
    setLocalCompanyId(id);
    onSelectCompany?.(id);
  };

  const rows = proposals.data ?? [];

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<Group />}>Shareholder governance</CardTitle>
        {allCompanies.length > 0 && (
          <div className="w-64">
            <CompanySelect
              id="exchange-governance-company"
              companies={allCompanies}
              value={companyId}
              onChange={handleSelectCompany}
            />
          </div>
        )}
      </div>

      {allCompanies.length === 0 ? (
        <EmptyState
          compact
          icon={<Group />}
          title="No companies to govern"
          message="Charter a company or acquire shares in one to vote on shareholder proposals."
        />
      ) : (
        <>
          <OfferBanner
            offers={offers.data ?? []}
            companyNames={companyNames}
            isOpen={overview.isOpen}
            onVote={(proposalId, support) => vote.mutate({ proposalId, support })}
            voting={vote.isPending}
          />

          {proposals.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              icon={<Group />}
              title="No shareholder proposals"
              message="Share issues, liquidations and acquisition offers appear here for shareholder ballots."
            />
          ) : (
            <ul className="divide-separator divide-y">
              {rows.map((p) => {
                const pctFor =
                  p.totalEligibleShares > 0
                    ? Math.round((p.sharesFor / p.totalEligibleShares) * 1000) / 10
                    : 0;
                const pctAgainst =
                  p.totalEligibleShares > 0
                    ? Math.round((p.sharesAgainst / p.totalEligibleShares) * 1000) / 10
                    : 0;
                return (
                  <li key={p.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-body text-label font-medium">
                          {PROPOSAL_TITLE[p.type] ?? p.type}
                        </p>
                        <p className="text-caption text-label-secondary">
                          {describeProposalPayload(p, companyNames)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.myVote && (
                          <Badge variant={p.myVote.support ? "success" : "warning"}>
                            Voted {p.myVote.support ? "for" : "against"} (
                            {p.myVote.shares.toLocaleString("en-US")})
                          </Badge>
                        )}
                        <StatusBadge status={p.status} />
                      </div>
                    </div>

                    <p className="text-caption text-label-secondary tabular-nums">
                      For: {p.sharesFor.toLocaleString("en-US")} shares ({pctFor}%) · Against:{" "}
                      {p.sharesAgainst.toLocaleString("en-US")} shares ({pctAgainst}%) · Eligible:{" "}
                      {p.totalEligibleShares.toLocaleString("en-US")} shares
                      {p.status === "OPEN" &&
                        ` · Closes ${new Date(p.expiresIxTime).toLocaleDateString()}`}
                    </p>

                    {overview.isOpen && p.status === "OPEN" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="xs"
                          variant={p.myVote?.support === true ? "default" : "secondary"}
                          disabled={vote.isPending}
                          onClick={() => vote.mutate({ proposalId: p.id, support: true })}
                        >
                          Vote for
                        </Button>
                        <Button
                          size="xs"
                          variant={p.myVote?.support === false ? "destructive" : "ghost"}
                          disabled={vote.isPending}
                          onClick={() => vote.mutate({ proposalId: p.id, support: false })}
                        >
                          Vote against
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {overview.isOpen && ownedCompany && ownedCompany.status === "ACTIVE" && (
            <OpenProposalForm
              companyId={ownedCompany.id}
              companyName={ownedCompany.name}
              onDone={refresh}
            />
          )}
        </>
      )}
    </Card>
  );
}
