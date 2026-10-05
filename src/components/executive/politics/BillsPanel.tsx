"use client";

import { useState } from "react";
import {
  Hammer as Gavel,
  Plus,
  Check,
  Xmark as X,
  Minus,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Card } from "~/components/ui/card";
import { IDEOLOGY_OPTIONS } from "./ideologies";
import { RepealPolicyButton } from "./RepealPolicyButton";

interface BillsPanelProps {
  countryId: string;
  /** Only the country owner can propose / vote. */
  canManage?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  in_committee: {
    label: "In committee",
    className: "bg-yellow/10 text-yellow-ink border-0",
  },
  active: {
    label: "Passed",
    className: "bg-green/10 text-green-ink border-0",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red/10 text-red-ink border-0",
  },
  repealed: {
    label: "Repealed",
    className: "bg-fill-3 text-label-secondary border-0",
  },
  expired: {
    label: "Expired",
    className: "bg-fill-3 text-label-secondary border-0",
  },
};

const VOTE_ICON = {
  yes: <Check className="text-green h-3 w-3" />,
  no: <X className="text-red h-3 w-3" />,
  abstain: <Minus className="text-label-secondary h-3 w-3" />,
} as const;

// A fogged vote projection before calling the floor; precision depends on standing.
function WhipCount({ billId }: { billId: string }) {
  const { data } = api.legislation.previewBillVote.useQuery({ billId }, { staleTime: 30_000 });
  if (!data) return null;
  if (!data.available) {
    return <p className="text-label-tertiary text-footnote italic">{data.reason}</p>;
  }
  const w = data.whip;
  const color =
    w.level === "greyed"
      ? "text-label-tertiary"
      : w.verdict === "pass" || w.verdict === "leaning_pass"
        ? "text-green"
        : w.verdict === "too_close"
          ? "text-yellow"
          : "text-red";
  return (
    <div className="rounded-control-sm bg-surface-secondary p-2">
      <p className="text-caption flex items-center gap-2 font-semibold">
        <Gavel aria-hidden className="text-label-secondary h-3 w-3" /> Whip count
        <span className="text-label-tertiary ml-auto font-normal">standing {data.standing}%</span>
      </p>
      <p className={`text-footnote mt-1 ${color}`}>
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
  const [ideology, setIdeology] = useState<(typeof IDEOLOGY_OPTIONS)[number]["value"]>("center");
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
      >
        <div className="flex items-center gap-3">
          <div>
            <h4 className="text-headline">Bills before the legislature</h4>
            <p className="text-label-secondary text-footnote mt-0.5">
              {bills && bills.length > 0
                ? `${committeeCount} pending, ${activeCount} passed`
                : "No bills proposed"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {committeeCount > 0 && (
            <Badge variant="warning" className="font-semibold">
              {committeeCount} pending
            </Badge>
          )}
          <ChevronRight className="text-label-secondary h-4 w-4" />
        </div>
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent size="wide" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Gavel aria-hidden className="text-label-secondary h-5 w-5" />
              <span>Legislative floor</span>
            </SheetTitle>
            <SheetDescription>
              Propose bills, see how the seated parties lean, and call floor votes.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-headline">Bills</span>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-footnote h-7 gap-1"
                  onClick={() => setShowForm((v) => !v)}
                >
                  <Plus className="h-3 w-3" />
                  {showForm ? "Cancel" : "Draft bill"}
                </Button>
              )}
            </div>

            {showForm && canManage && (
              <Card variant="well" padding="none" className="space-y-2 p-3">
                <input
                  className="bg-surface border-separator rounded-control-sm text-body focus:ring-tint w-full border px-2 py-2 focus:ring-1 focus:outline-none"
                  placeholder="Bill name (e.g. Healthcare Reform Act)"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
                <textarea
                  className="bg-surface border-separator rounded-control-sm text-body focus:ring-tint w-full border px-2 py-2 focus:ring-1 focus:outline-none"
                  placeholder="What the bill does"
                  rows={2}
                  value={description}
                  maxLength={1000}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-label-secondary text-footnote">Lean</label>
                    <OptionSelect
                      aria-label="Lean"
                      value={ideology}
                      onValueChange={(v) => setIdeology(v as typeof ideology)}
                      options={IDEOLOGY_OPTIONS}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-label-secondary text-footnote">Growth effect %</label>
                    <input
                      type="number"
                      step={0.5}
                      min={-5}
                      max={5}
                      className="bg-surface border-separator rounded-control-sm text-footnote w-16 border px-2 py-1"
                      value={gdpEffect}
                      onChange={(e) => setGdpEffect(Number(e.target.value))}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="text-footnote h-7 w-full"
                  disabled={!name.trim() || !description.trim() || propose.isPending}
                  onClick={() =>
                    propose.mutate({ countryId, name, description, ideology, gdpEffect })
                  }
                >
                  {propose.isPending ? "Submitting" : "Submit to committee"}
                </Button>
              </Card>
            )}

            {bills && bills.length > 0 ? (
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {bills.map((bill) => {
                  const statusMeta = STATUS_BADGE[bill.status] ?? STATUS_BADGE.in_committee!;
                  const result = bill.meta?.voteResult;
                  const isBillExpanded = expanded === bill.id;
                  return (
                    <div
                      key={bill.id}
                      className="bg-fill-4 border-separator rounded-row border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-expanded={isBillExpanded}
                          className="text-body hover:text-tint min-w-0 flex-1 truncate text-left font-medium transition-colors"
                          onClick={() => setExpanded(isBillExpanded ? null : bill.id)}
                        >
                          {bill.name}
                        </button>
                        <div className="flex items-center gap-2">
                          {result && (
                            <span className="text-label-secondary bg-fill-3 text-footnote rounded-control-sm px-2 py-0.5 tabular-nums">
                              {result.yesSeats}–{result.noSeats}
                            </span>
                          )}
                          <Badge
                            className={`text-caption px-2 py-0.5 font-semibold ${statusMeta.className}`}
                            variant="secondary"
                          >
                            {statusMeta.label}
                          </Badge>
                          {canManage && bill.status === "in_committee" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-footnote h-6 px-3"
                              disabled={holdVote.isPending}
                              onClick={() => holdVote.mutate({ billId: bill.id })}
                            >
                              Call vote
                            </Button>
                          )}
                          {canManage && bill.status === "active" && (
                            <RepealPolicyButton
                              policyId={bill.id}
                              policyName={bill.name}
                              onRepealed={() => void refetch()}
                            />
                          )}
                        </div>
                      </div>
                      {isBillExpanded && (
                        <div className="text-label-secondary border-separator text-footnote mt-2 space-y-2 border-t pt-2">
                          <p>{bill.description}</p>
                          {bill.gdpEffect !== 0 && (
                            <p className="font-semibold">
                              Projected growth effect: {bill.gdpEffect > 0 ? "+" : ""}
                              {bill.gdpEffect}% GDP
                            </p>
                          )}
                          {bill.status === "in_committee" && <WhipCount billId={bill.id} />}
                          {result && (
                            <Card variant="well" padding="none" className="space-y-1 p-2">
                              <p className="text-label text-caption mb-1">Floor vote breakdown</p>
                              {result.breakdown.map((pv) => (
                                <div
                                  key={pv.partyId}
                                  className="border-separator flex items-center justify-between gap-2 border-b py-0.5 last:border-b-0"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    {VOTE_ICON[pv.vote]}
                                    <span className="text-label truncate font-medium">
                                      {pv.partyName}
                                    </span>
                                  </div>
                                  <span className="text-label-secondary text-footnote">
                                    {pv.seats} seats
                                  </span>
                                </div>
                              ))}
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-label-secondary flex flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-body">No bills before the legislature</p>
                {canManage && <p className="text-footnote">Draft a bill and call it to a vote.</p>}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
