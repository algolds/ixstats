"use client";

import { useState } from "react";
import { StatsReport } from "iconoir-react";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LensCard } from "~/components/ui/lens-card";
import { Pill, SectionTitle } from "./brand";

/** The terms every domestic company borrows on: an extra spread and a per-company cap. */
export function TreasuryLending({
  countryId,
  spread,
  cap,
}: {
  countryId: string;
  spread: number;
  cap: number;
}) {
  const [spreadRaw, setSpreadRaw] = useState(String(Number((spread * 100).toFixed(2))));
  const [capRaw, setCapRaw] = useState(String(cap));
  const utils = api.useUtils();
  const save = api.exchange.setLendingTerms.useMutation();
  const s = Number(spreadRaw) / 100;
  const c = Number(capRaw);
  const valid =
    Number.isFinite(s) && s >= -0.02 && s <= 0.1 && Number.isFinite(c) && c >= 0 && c <= 250_000;
  return (
    <LensCard app="exchange" content="input" padding="md" className="space-y-3">
      <SectionTitle icon={<StatsReport />}>Lending terms</SectionTitle>
      <p className="text-footnote text-label-secondary">
        Every company based in your nation borrows on these terms, your own included: your interest
        rate plus its rating spread, plus the extra spread below.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="lend-spread">Extra spread (%)</Label>
          <Input
            id="lend-spread"
            inputMode="decimal"
            value={spreadRaw}
            onChange={(e) => setSpreadRaw(e.target.value)}
          />
          <p className="text-caption text-label-secondary">-2 to 10</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lend-cap">Credit cap per company</Label>
          <Input
            id="lend-cap"
            inputMode="decimal"
            value={capRaw}
            onChange={(e) => setCapRaw(e.target.value)}
          />
          <p className="text-caption text-label-secondary">₷0 to ₷250,000</p>
        </div>
      </div>
      {save.error && <p className="text-footnote text-destructive">{save.error.message}</p>}
      <Pill
        tone="plain"
        disabled={!valid || save.isPending}
        onClick={() =>
          save.mutate(
            { countryId, spread: s, cap: c },
            { onSuccess: () => void utils.exchange.invalidate() }
          )
        }
      >
        Save lending terms
      </Pill>
    </LensCard>
  );
}
