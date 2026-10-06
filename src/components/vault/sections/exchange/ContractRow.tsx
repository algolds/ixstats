"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { CompanySelect, StatusBadge, formatSovereigns, parseAmount, sectorLabel } from "./shared";

type Contract = RouterOutputs["exchange"]["listContracts"][number];

interface ContractRowProps {
  contract: Contract;
  /** The viewer's ACTIVE companies, for bidding. */
  companies: ReadonlyArray<{ id: string; name: string }>;
  isOpen: boolean;
  onDone: () => void;
}

function useContractActions(onDone: () => void) {
  const notify = useNotify();
  const handlers = (title: string) => ({
    onSuccess: () => {
      notify.success(title);
      onDone();
    },
    onError: (e: { message: string }) => notify.error("Action failed", e.message),
  });
  return {
    placeBid: api.exchange.placeBid.useMutation(handlers("Bid placed")),
    withdrawBid: api.exchange.withdrawBid.useMutation(handlers("Bid withdrawn")),
    award: api.exchange.awardContract.useMutation(handlers("Contract awarded")),
    complete: api.exchange.completeContract.useMutation(handlers("Contractor paid")),
    cancel: api.exchange.cancelContract.useMutation(handlers("Contract cancelled")),
    release: api.exchange.releaseContract.useMutation(handlers("Contract released")),
    dispute: api.exchange.disputeContract.useMutation(handlers("Dispute opened")),
  };
}

function BidForm({
  contract,
  companies,
  actions,
}: {
  contract: Contract;
  companies: ContractRowProps["companies"];
  actions: ReturnType<typeof useContractActions>;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [raw, setRaw] = useState(String(contract.value));
  const amount = parseAmount(raw);
  if (companies.length === 0) {
    return (
      <p className="text-caption text-label-secondary">Charter a company to bid on contracts.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-48">
        <CompanySelect
          id={`bid-company-${contract.id}`}
          companies={companies}
          value={companyId}
          onChange={setCompanyId}
        />
      </div>
      <div className="w-32">
        <Input
          aria-label="Your price"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>
      <Button
        size="sm"
        disabled={actions.placeBid.isPending || !companyId || Number.isNaN(amount)}
        onClick={() => actions.placeBid.mutate({ contractId: contract.id, companyId, amount })}
      >
        Bid
      </Button>
    </div>
  );
}

function DisputeForm({
  contractId,
  actions,
}: {
  contractId: string;
  actions: ReturnType<typeof useContractActions>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Dispute
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <Input
          aria-label="What went wrong"
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What went wrong"
        />
      </div>
      <Button
        size="sm"
        variant="destructive"
        disabled={actions.dispute.isPending || reason.trim().length < 5}
        onClick={() => actions.dispute.mutate({ contractId, reason })}
      >
        Send to an admin
      </Button>
    </div>
  );
}

/** One contract with the actions the viewer's role allows. */
export function ContractRow({ contract, companies, isOpen, onDone }: ContractRowProps) {
  const actions = useContractActions(onDone);
  const myBid = contract.bids.find((b) => b.mine);
  const { role, status } = contract;

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body text-label font-medium">{contract.title}</p>
          <p className="text-caption text-label-secondary">
            {contract.issuer?.name ?? "Government"} · {sectorLabel(contract.sectorKey)} ·{" "}
            {formatSovereigns(contract.value)}
            {contract.biddingOpen &&
              ` · bids close ${new Date(contract.biddingClosesAt).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contract.type === "B2G" && <Badge variant="info">Government tender</Badge>}
          <StatusBadge status={status} />
        </div>
      </div>
      {contract.description && (
        <p className="text-footnote text-label-secondary whitespace-pre-line">
          {contract.description}
        </p>
      )}

      {role === "issuer" && status === "OPEN" && (
        <div className="space-y-2">
          <p className="text-footnote text-label font-medium">Bids ({contract.bids.length})</p>
          {contract.bids.map((b) => (
            <div key={b.id} className="text-footnote flex items-center justify-between gap-2">
              <span className="text-label">
                {b.company.name}{" "}
                <span className="text-label-secondary">standing {b.company.standing}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatSovereigns(b.amount)}</span>
                {isOpen && (
                  <Button
                    size="xs"
                    disabled={actions.award.isPending}
                    onClick={() => actions.award.mutate({ contractId: contract.id, bidId: b.id })}
                  >
                    Award
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {role !== "issuer" && myBid && (
        <p className="text-footnote text-label-secondary">
          Your bid from {myBid.company.name}: {formatSovereigns(myBid.amount)}
          {myBid.outcome ? ` (${myBid.outcome === "WON" ? "won" : "not chosen"})` : ""}
        </p>
      )}

      {isOpen && (
        <div className="flex flex-wrap items-center gap-2">
          {role !== "issuer" && contract.biddingOpen && (
            <BidForm contract={contract} companies={companies} actions={actions} />
          )}
          {role !== "issuer" && status === "OPEN" && myBid && !myBid.outcome && (
            <Button
              size="sm"
              variant="ghost"
              disabled={actions.withdrawBid.isPending}
              onClick={() => actions.withdrawBid.mutate({ bidId: myBid.id })}
            >
              Withdraw bid
            </Button>
          )}
          {role === "issuer" && status === "OPEN" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={actions.cancel.isPending}
              onClick={() => actions.cancel.mutate({ contractId: contract.id })}
            >
              Cancel and refund
            </Button>
          )}
          {role === "issuer" && status === "AWARDED" && (
            <Button
              size="sm"
              disabled={actions.complete.isPending}
              onClick={() => actions.complete.mutate({ contractId: contract.id })}
            >
              Confirm delivery and pay {formatSovereigns(contract.escrow)}
            </Button>
          )}
          {role === "contractor" && status === "AWARDED" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={actions.release.isPending}
              onClick={() => actions.release.mutate({ contractId: contract.id })}
            >
              Release contract
            </Button>
          )}
          {(role === "issuer" || role === "contractor") && status === "AWARDED" && (
            <DisputeForm contractId={contract.id} actions={actions} />
          )}
        </div>
      )}

      {status === "DISPUTED" && (
        <p className="text-footnote text-warning-ink">
          Disputed: {contract.disputeReason}. An admin will decide; escrow is held until then.
        </p>
      )}
      {contract.resolutionNote && (
        <p className="text-footnote text-label-secondary">Admin note: {contract.resolutionNote}</p>
      )}
    </Card>
  );
}
