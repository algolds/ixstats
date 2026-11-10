"use client";

import { useEffect, useState } from "react";
import { Activity, Coins, Settings, WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";

const CONFIG_FIELDS = [
  { key: "charterFee", label: "Company charter fee (₷)", step: "1" },
  { key: "activeCompanyCap", label: "Active companies per player", step: "1" },
  { key: "seedSovereigns", label: "Starting balance for new wallets (₷)", step: "1" },
  { key: "treasuryDailyStipend", label: "Base daily nation treasury stipend (₷)", step: "1" },
  { key: "treasuryCap", label: "Nation treasury balance cap (₷)", step: "1" },
  { key: "realmWeeklyFaucetCap", label: "Realm weekly faucet tender cap (₷)", step: "1" },
  { key: "realmOperatingBudget", label: "Realm operating budget per tick (₷)", step: "1" },
] as const;

type ConfigKey = (typeof CONFIG_FIELDS)[number]["key"];
type SectorKey = "agriculture" | "industry" | "services" | "government";

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

function MarketTickSection() {
  const notify = useNotify();
  const tick = api.exchange.adminRunMarketTick.useMutation({
    onSuccess: (r) => {
      notify.success(
        "Market tick completed",
        `Minted ₷${r.stipendsMinted.toLocaleString("en-US")} in stipends · refreshed ${r.companiesRefreshed} companies`
      );
    },
    onError: (e) => notify.error("Market tick failed", e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-footnote text-label-secondary">
          Mints nation treasury stipends, updates sector indices, runs company P&L operations,
          applies due strategic decisions, settles expired proposals and syncs corporate GDP
          feedback.
        </p>
        <Button size="sm" disabled={tick.isPending} onClick={() => tick.mutate()}>
          {tick.isPending ? "Running tick..." : "Run market tick now"}
        </Button>
      </div>
      {tick.data && (
        <Card variant="well" padding="sm" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="text-caption tabular-nums">
            <span className="text-label-secondary block">Stipends minted</span>
            <span className="text-label font-medium">
              ₷{tick.data.stipendsMinted.toLocaleString("en-US")}
            </span>
          </div>
          <div className="text-caption tabular-nums">
            <span className="text-label-secondary block">Decisions applied</span>
            <span className="text-label font-medium">{tick.data.decisionsApplied}</span>
          </div>
          <div className="text-caption tabular-nums">
            <span className="text-label-secondary block">Proposals expired</span>
            <span className="text-label font-medium">{tick.data.proposalsExpired}</span>
          </div>
          <div className="text-caption tabular-nums">
            <span className="text-label-secondary block">Companies refreshed</span>
            <span className="text-label font-medium">{tick.data.companiesRefreshed}</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function SectorDmForm() {
  const notify = useNotify();
  const [dmState, setDmState] = useState({
    realmId: "default",
    sectorKey: "services" as SectorKey,
    value: "0",
  });
  const setMod = api.exchange.adminSetSectorDmModifier.useMutation({
    onSuccess: (r) => {
      notify.success(
        "Sector modifier saved",
        `${r.label} in ${r.realmId} set to ${r.dmModifier}`
      );
    },
    onError: (e) => notify.error("Could not set modifier", e.message),
  });
  const val = Number(dmState.value);
  const valid =
    Boolean(dmState.realmId.trim()) && Number.isFinite(val) && val >= -0.5 && val <= 2;

  return (
    <form
      className="grid gap-3 sm:grid-cols-4 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setMod.mutate({
          realmId: dmState.realmId.trim(),
          sectorKey: dmState.sectorKey,
          value: val,
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-dm-realm">Realm id</Label>
        <Input
          id="exchange-dm-realm"
          value={dmState.realmId}
          onChange={(e) => setDmState({ ...dmState, realmId: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-dm-sector">Sector</Label>
        <Select
          value={dmState.sectorKey}
          onValueChange={(v) => setDmState({ ...dmState, sectorKey: v as SectorKey })}
        >
          <SelectTrigger id="exchange-dm-sector" size="sm" aria-label="Sector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agriculture">Agriculture</SelectItem>
            <SelectItem value="industry">Industry</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="government">Government</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-dm-value">Modifier (-0.5 to 2.0)</Label>
        <Input
          id="exchange-dm-value"
          type="number"
          step="0.05"
          min="-0.5"
          max="2"
          value={dmState.value}
          onChange={(e) => setDmState({ ...dmState, value: e.target.value })}
        />
      </div>
      <Button type="submit" size="sm" disabled={setMod.isPending || !valid}>
        Set sector modifier
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
    <Card variant="well" padding="md" className="space-y-2">
      <p className="text-body text-label font-medium">{dispute.title}</p>
      <p className="text-footnote text-label-secondary tabular-nums">
        Issued by {dispute.issuerCompany?.name ?? "a nation (government tender)"}. Escrow ₷
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
    </Card>
  );
}

function AdjustForm() {
  const notify = useNotify();
  const [adjustState, setAdjustState] = useState({
    userId: "",
    amount: "",
    reason: "",
  });
  const adjust = api.exchange.adminAdjustSovereigns.useMutation({
    onSuccess: (r) => {
      notify.success("Balance adjusted", `New balance ₷${r.newBalance.toLocaleString("en-US")}`);
      setAdjustState((prev) => ({ ...prev, amount: "", reason: "" }));
    },
    onError: (e) => notify.error("Could not adjust", e.message),
  });
  const n = Number(adjustState.amount);
  return (
    <form
      className="grid gap-3 sm:grid-cols-4 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        adjust.mutate({
          targetUserId: adjustState.userId.trim(),
          amount: n,
          reason: adjustState.reason,
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-adjust-user">User id or Clerk id</Label>
        <Input
          id="exchange-adjust-user"
          value={adjustState.userId}
          onChange={(e) => setAdjustState({ ...adjustState, userId: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-adjust-amount">Amount (negative debits)</Label>
        <Input
          id="exchange-adjust-amount"
          type="number"
          value={adjustState.amount}
          onChange={(e) => setAdjustState({ ...adjustState, amount: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exchange-adjust-reason">Reason</Label>
        <Input
          id="exchange-adjust-reason"
          value={adjustState.reason}
          onChange={(e) => setAdjustState({ ...adjustState, reason: e.target.value })}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={
          adjust.isPending ||
          !adjustState.userId.trim() ||
          !n ||
          adjustState.reason.trim().length < 3
        }
      >
        Adjust Sovereigns
      </Button>
    </form>
  );
}

/** Admin: Exchange rates and limits, manual market ticks, sector DM modifiers, disputes and ₷ balance adjustments. */
export function ExchangeAdmin() {
  const disputes = api.exchange.adminListDisputes.useQuery();
  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle icon={<Settings />}>Exchange config</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigForm />
        </CardContent>
      </Card>
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle icon={<Activity />}>Market tick and sector DM lever</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <MarketTickSection />
          <SectorDmForm />
        </CardContent>
      </Card>
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle icon={<WarningTriangle />}>Disputed contracts</CardTitle>
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
          <CardTitle icon={<Coins />}>Adjust a Sovereign balance</CardTitle>
        </CardHeader>
        <CardContent>
          <AdjustForm />
        </CardContent>
      </Card>
    </div>
  );
}
