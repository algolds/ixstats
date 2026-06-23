"use client";

import { useState } from "react";
import { Gavel, Plus, Check, X, Minus } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

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

export function BillsPanel({ countryId, canManage = true }: BillsPanelProps) {
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

  return (
    <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold">Bills on the Floor</span>
          {bills && bills.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {bills.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3 w-3" />
            Draft Bill
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <div className="bg-muted/30 space-y-2 rounded-md p-3">
          <input
            className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
            placeholder="Bill name (e.g. Healthcare Reform Act)"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="bg-background border-border w-full rounded-md border px-2 py-1.5 text-sm"
            placeholder="What the bill does…"
            rows={2}
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-muted-foreground text-xs">Lean</label>
            <select
              className="bg-background border-border rounded-md border px-2 py-1 text-sm"
              value={ideology}
              onChange={(e) => setIdeology(e.target.value as typeof ideology)}
            >
              {IDEOLOGIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
            <label className="text-muted-foreground text-xs">Growth effect %</label>
            <input
              type="number"
              step={0.5}
              min={-5}
              max={5}
              className="bg-background border-border w-16 rounded-md border px-2 py-1 text-sm"
              value={gdpEffect}
              onChange={(e) => setGdpEffect(Number(e.target.value))}
            />
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
        <div className="space-y-1.5">
          {bills.map((bill) => {
            const statusMeta = STATUS_BADGE[bill.status] ?? STATUS_BADGE.in_committee!;
            const result = bill.meta?.voteResult;
            const isOpen = expanded === bill.id;
            return (
              <div key={bill.id} className="bg-muted/30 rounded-md px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <button
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => setExpanded(isOpen ? null : bill.id)}
                  >
                    {bill.name}
                  </button>
                  {result && (
                    <span className="text-muted-foreground text-[10px]">
                      {result.yesSeats}–{result.noSeats}
                    </span>
                  )}
                  <Badge className={`px-1.5 py-0 text-[10px] ${statusMeta.className}`}>
                    {statusMeta.label}
                  </Badge>
                  {canManage && bill.status === "in_committee" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      disabled={holdVote.isPending}
                      onClick={() => holdVote.mutate({ billId: bill.id })}
                    >
                      Call Vote
                    </Button>
                  )}
                </div>
                {isOpen && (
                  <div className="text-muted-foreground mt-1.5 space-y-1 text-xs">
                    <p>{bill.description}</p>
                    {result && (
                      <div className="space-y-0.5 pt-1">
                        {result.breakdown.map((pv) => (
                          <div key={pv.partyId} className="flex items-center gap-1.5">
                            {VOTE_ICON[pv.vote]}
                            <span className="flex-1 truncate">{pv.partyName}</span>
                            <span>{pv.seats} seats</span>
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
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Gavel className="h-8 w-8 opacity-30" />
          <p className="text-sm">No bills before the legislature</p>
          {canManage && <p className="text-xs">Draft a bill and call it to a vote.</p>}
        </div>
      )}
    </div>
  );
}
