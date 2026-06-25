"use client";

import { useState } from "react";
import { Gavel, Plus, Check, X, Minus, ChevronRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface BillsPanelProps {
  countryId: string;
  /** Only the country owner can propose / vote. */
  canManage?: boolean;
}

const IDEOLOGIES = [
  { value: "far_left", label: "Far Left" },
  { value: "left", label: "Left" },
  { value: "center_left", label: "Centre-Left" },
  { value: "center", label: "Centre" },
  { value: "center_right", label: "Centre-Right" },
  { value: "right", label: "Right" },
  { value: "far_right", label: "Far Right" },
] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  in_committee: {
    label: "In Committee",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-0",
  },
  active: {
    label: "Passed",
    className: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-0",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-0",
  },
};

const VOTE_ICON = {
  yes: <Check className="h-3 w-3 text-green-600" />,
  no: <X className="h-3 w-3 text-red-600" />,
  abstain: <Minus className="h-3 w-3 text-muted-foreground" />,
} as const;

// S3.A: a fogged vote projection before calling the floor. Precision gated by standing.
function WhipCount({ billId }: { billId: string }) {
  const { data } = api.legislation.previewBillVote.useQuery({ billId }, { staleTime: 30_000 });
  if (!data) return null;
  if (!data.available) {
    return <p className="text-muted-foreground/60 text-[11px] italic">{data.reason}</p>;
  }
  const w = data.whip;
  const color =
    w.level === "greyed"
      ? "text-muted-foreground/60"
      : w.verdict === "pass" || w.verdict === "leaning_pass"
        ? "text-emerald-500"
        : w.verdict === "too_close"
          ? "text-amber-500"
          : "text-red-500";
  return (
    <div className="rounded-md border border-amber-500/15 bg-amber-500/[0.03] p-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold">
        <Gavel className="h-3 w-3 text-amber-500" /> Whip Count
        <span className="text-muted-foreground/50 ml-auto font-normal">
          standing {data.standing}%
        </span>
      </p>
      <p className={`mt-1 text-[11px] ${color}`}>
        {w.caption}
        {w.yesSeats != null ? ` (${w.yesSeats}–${w.noSeats})` : ""}
      </p>
    </div>
  );
}

export function BillsPanel({ countryId, canManage = true }: BillsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ideology, setIdeology] = useState<(typeof IDEOLOGIES)[number]["value"]>("center");
  const [gdpEffect, setGdpEffect] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: bills, refetch } = api.legislation.getBills.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const propose = api.legislation.proposeBill.useMutation({
    onSuccess: () => {
      setName("");
      setDescription("");
      setGdpEffect(0);
      setShowForm(false);
      void refetch();
    },
  });
  const holdVote = api.legislation.holdVote.useMutation({
    onSuccess: () => void refetch(),
  });

  const committeeCount = bills?.filter((b) => b.status === "in_committee").length ?? 0;
  const activeCount = bills?.filter((b) => b.status === "active").length ?? 0;

  return (
    <>
      {/* Trigger Card - Facet Compliant */}
      <button
        onClick={() => setIsOpen(true)}
        className="glass-hierarchy-child border-border flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all hover:bg-muted/10 hover:shadow-md active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-500/10 p-2.5">
            <Gavel className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Bills on the Floor</h4>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {bills && bills.length > 0
                ? `${committeeCount} pending, ${activeCount} passed laws`
                : "No legislative bills proposed yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {committeeCount > 0 && (
            <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-semibold hover:bg-amber-500/20">
              {committeeCount} Pending
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {/* Floor Vote Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl md:max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-indigo-500" />
              <span>Legislative Floor</span>
            </DialogTitle>
            <DialogDescription>
              Propose new laws, view the voting alignment of seated parties, and call floor votes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Bills list</span>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setShowForm((v) => !v)}
                >
                  <Plus className="h-3 w-3" />
                  {showForm ? "Cancel" : "Draft Bill"}
                </Button>
              )}
            </div>

            {showForm && canManage && (
              <div className="bg-muted/30 border border-border/50 space-y-2 rounded-xl p-3">
                <input
                  className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Bill name (e.g. Healthcare Reform Act)"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
                <textarea
                  className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="What the bill does…"
                  rows={2}
                  value={description}
                  maxLength={1000}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-muted-foreground text-xs">Lean</label>
                    <select
                      className="bg-background border-border rounded-md border px-2 py-1 text-xs"
                      value={ideology}
                      onChange={(e) => setIdeology(e.target.value as typeof ideology)}
                    >
                      {IDEOLOGIES.map((i) => (
                        <option key={i.value} value={i.value}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-muted-foreground text-xs">Growth effect %</label>
                    <input
                      type="number"
                      step={0.5}
                      min={-5}
                      max={5}
                      className="bg-background border-border w-16 rounded-md border px-2 py-1 text-xs"
                      value={gdpEffect}
                      onChange={(e) => setGdpEffect(Number(e.target.value))}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 w-full text-xs"
                  disabled={!name.trim() || !description.trim() || propose.isPending}
                  onClick={() =>
                    propose.mutate({ countryId, name, description, ideology, gdpEffect })
                  }
                >
                  {propose.isPending ? "Submitting…" : "Submit to Committee"}
                </Button>
              </div>
            )}

            {bills && bills.length > 0 ? (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {bills.map((bill) => {
                  const statusMeta = STATUS_BADGE[bill.status] ?? STATUS_BADGE.in_committee!;
                  const result = bill.meta?.voteResult;
                  const isBillExpanded = expanded === bill.id;
                  return (
                    <div key={bill.id} className="bg-muted/30 border border-border/30 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-indigo-500 transition-colors"
                          onClick={() => setExpanded(isBillExpanded ? null : bill.id)}
                        >
                          {bill.name}
                        </button>
                        <div className="flex items-center gap-2">
                          {result && (
                            <span className="text-muted-foreground text-[11px] tabular-nums bg-muted px-1.5 py-0.5 rounded">
                              {result.yesSeats}–{result.noSeats}
                            </span>
                          )}
                          <Badge className={`px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </Badge>
                          {canManage && bill.status === "in_committee" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2.5 text-[10px] border-indigo-500/20 bg-indigo-500/5 text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
                              disabled={holdVote.isPending}
                              onClick={() => holdVote.mutate({ billId: bill.id })}
                            >
                              Call Vote
                            </Button>
                          )}
                        </div>
                      </div>
                      {isBillExpanded && (
                        <div className="text-muted-foreground mt-2 space-y-2 text-xs border-t border-border/40 pt-2">
                          <p>{bill.description}</p>
                          {bill.gdpEffect !== 0 && (
                            <p className="font-semibold text-indigo-500/90">
                              Projected Growth Effect: {bill.gdpEffect > 0 ? "+" : ""}{bill.gdpEffect}% GDP
                            </p>
                          )}
                          {bill.status === "in_committee" && <WhipCount billId={bill.id} />}
                          {result && (
                            <div className="bg-muted/40 border border-border/20 rounded-lg p-2.5 space-y-1">
                              <p className="font-medium text-foreground mb-1 text-[11px]">Floor Vote Breakdown</p>
                              {result.breakdown.map((pv) => (
                                <div key={pv.partyId} className="flex items-center justify-between gap-1.5 py-0.5 border-b border-border/10 last:border-b-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {VOTE_ICON[pv.vote]}
                                    <span className="truncate text-foreground/90 font-medium">{pv.partyName}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{pv.seats} seats</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Gavel className="h-8 w-8 opacity-30" />
                <p className="text-sm">No bills before the legislature</p>
                {canManage && <p className="text-xs">Draft a bill and call it to a vote.</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
