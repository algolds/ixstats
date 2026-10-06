"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";

const CONFIG_FIELDS = [
  { key: "convertRate", label: "Sovereigns per IxCredit", step: "0.01" },
  { key: "convertFee", label: "Conversion fee (0.05 = 5%)", step: "0.01" },
  { key: "convertDailyLimit", label: "Daily conversion limit (₷)", step: "1" },
  { key: "charterFee", label: "Company charter fee (₷)", step: "1" },
  { key: "activeCompanyCap", label: "Active companies per player", step: "1" },
  { key: "seedSovereigns", label: "Starting balance for new wallets (₷)", step: "1" },
] as const;

type ConfigKey = (typeof CONFIG_FIELDS)[number]["key"];

function ConfigForm() {
  const notify = useNotify();
  const config = api.exchange.adminGetExchangeConfig.useQuery();
  const [form, setForm] = useState<Record<ConfigKey, string> | null>(null);
  useEffect(() => {
    if (config.data) {
      setForm(
        Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, String(config.data[f.key])])) as Record<
          ConfigKey,
          string
        >
      );
    }
  }, [config.data]);
  const save = api.exchange.adminSaveExchangeConfig.useMutation({
    onSuccess: () => {
      notify.success("Exchange config saved");
      void config.refetch();
    },
    onError: (e) => notify.error("Could not save", e.message),
  });

  if (!form) return <Skeleton className="h-48 w-full" />;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(
          CONFIG_FIELDS.map((f) => [f.key, Number(form[f.key])])
        ) as Record<ConfigKey, number>;
        save.mutate(values);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CONFIG_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={`exchange-${f.key}`}>{f.label}</Label>
            <Input
              id={`exchange-${f.key}`}
              type="number"
              step={f.step}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <p className="text-footnote text-label-secondary">
        Turn the Exchange on or off under System config. A new starting balance applies to wallets
        created from now on; existing balances never change.
      </p>
      <Button type="submit" size="sm" disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save Exchange config"}
      </Button>
    </form>
  );
}

function DisputeRow({
  dispute,
  onDone,
}: {
  dispute: {
    id: string;
    title: string;
    escrow: number;
    disputeReason: string | null;
    issuerCompany: { name: string } | null;
  };
  onDone: () => void;
}) {
  const notify = useNotify();
  const [note, setNote] = useState("");
  const resolve = api.exchange.adminResolveDispute.useMutation({
    onSuccess: () => {
      notify.success("Dispute resolved");
      onDone();
    },
    onError: (e) => notify.error("Could not resolve", e.message),
  });
  const ready = note.trim().length >= 3 && !resolve.isPending;
  return (
    <div className="border-separator rounded-control space-y-2 border p-4">
      <p className="text-body text-label font-medium">{dispute.title}</p>
      <p className="text-footnote text-label-secondary">
        Issued by {dispute.issuerCompany?.name ?? "unknown"}. Escrow ₷
        {dispute.escrow.toLocaleString("en-US")}. Reason: {dispute.disputeReason}
      </p>
      <Input
        aria-label="Decision note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Decision note shown to both parties"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!ready}
          onClick={() =>
            resolve.mutate({ contractId: dispute.id, outcome: "PAY_CONTRACTOR", note })
          }
        >
          Pay the contractor
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!ready}
          onClick={() => resolve.mutate({ contractId: dispute.id, outcome: "REFUND_ISSUER", note })}
        >
          Refund the issuer
        </Button>
      </div>
    </div>
  );
}

function AdjustForm() {
  const notify = useNotify();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const adjust = api.exchange.adminAdjustSovereigns.useMutation({
    onSuccess: (r) => {
      notify.success("Balance adjusted", `New balance ₷${r.newBalance.toLocaleString("en-US")}`);
      setAmount("");
      setReason("");
    },
    onError: (e) => notify.error("Could not adjust", e.message),
  });
  const n = Number(amount);
  return (
    <form
      className="grid gap-3 sm:grid-cols-4 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        adjust.mutate({ targetUserId: userId.trim(), amount: n, reason });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-adjust-user">User id or Clerk id</Label>
        <Input
          id="exchange-adjust-user"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-adjust-amount">Amount (negative debits)</Label>
        <Input
          id="exchange-adjust-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-adjust-reason">Reason</Label>
        <Input
          id="exchange-adjust-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={adjust.isPending || !userId.trim() || !n || reason.trim().length < 3}
      >
        Adjust Sovereigns
      </Button>
    </form>
  );
}

/** Admin: Exchange rates and limits, dispute decisions, ₷ balance adjustments. */
export function ExchangeAdmin() {
  const disputes = api.exchange.adminListDisputes.useQuery();
  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="text-label text-title-3">Exchange config</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigForm />
        </CardContent>
      </Card>
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="text-label text-title-3">Disputed contracts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {disputes.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (disputes.data ?? []).length === 0 ? (
            <EmptyState compact title="No disputes" message="Nothing is waiting for a decision." />
          ) : (
            (disputes.data ?? []).map((d) => (
              <DisputeRow key={d.id} dispute={d} onDone={() => void disputes.refetch()} />
            ))
          )}
        </CardContent>
      </Card>
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="text-label text-title-3">Adjust a Sovereign balance</CardTitle>
        </CardHeader>
        <CardContent>
          <AdjustForm />
        </CardContent>
      </Card>
    </div>
  );
}
