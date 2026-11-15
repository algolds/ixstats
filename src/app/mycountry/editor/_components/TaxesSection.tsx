"use client";

import { useMemo, useState } from "react";
import { Coins } from "iconoir-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Slider } from "~/components/ui/slider";
import { Stat } from "~/components/ui/stat";
import { RateInput } from "~/components/mycountry/shell/RateInput";
import { useNotify } from "~/hooks/useNotify";
import { nationalRevenue, REVENUE_BASIS_NOTE } from "~/lib/economy/national-revenue";
import {
  ACCENT_BG,
  fiscalUpdateForRate,
  readSavedRates,
  TAX_CHANNELS,
  type FiscalRateUpdate,
  type TaxChannel,
} from "~/lib/economy/tax-channels";
import { cn } from "~/lib/utils/cn";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { api } from "~/trpc/react";
import { EditorSection, SaveButton } from "./EditorSection";
import { useEditor, useReportDirty, type EditorState } from "./editor-context";

function FlattenBracketsButton({
  channel,
  topRate,
  onConfirm,
}: {
  channel: TaxChannel;
  topRate: number;
  onConfirm: (flatRate: number) => void;
}) {
  const flatRate = Math.min(Math.max(topRate, channel.min), channel.max);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Use one rate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace the brackets with one rate?</AlertDialogTitle>
          <AlertDialogDescription>
            {channel.label} becomes a flat {flatRate}%
            {flatRate === topRate ? ", the top bracket rate" : ", the most this tax allows"}, which
            you can then change and save. The bracket list cannot be restored here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep brackets</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(flatRate)}>Use one rate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TaxChannelWell({
  channel,
  rate,
  bracketed,
  yieldValue,
  totalYield,
  onChange,
  onFlatten,
}: {
  channel: TaxChannel;
  rate: number | null;
  bracketed: boolean;
  yieldValue: number | null;
  totalYield: number | null;
  onChange: (next: number) => void;
  onFlatten: (flatRate: number) => void;
}) {
  const sliderValue = rate ?? channel.min;
  const sharePct =
    yieldValue != null && totalYield != null && totalYield > 0
      ? (yieldValue / totalYield) * 100
      : 0;

  return (
    <Card variant="well" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2.5 shrink-0 rounded-full", ACCENT_BG[channel.accent])}
          />
          <span className="text-label text-subhead truncate font-medium">{channel.label}</span>
        </div>
        <span className="text-label text-title-3 shrink-0 tabular-nums">
          {rate != null ? (
            <>
              {bracketed && <span className="text-label-secondary text-footnote mr-1">Top</span>}
              {rate.toFixed(1)}%
            </>
          ) : (
            <span className="text-label-secondary text-footnote font-normal">Not set</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Slider
          min={channel.min}
          max={channel.max}
          step={channel.step}
          value={[sliderValue]}
          disabled={bracketed}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          aria-label={`${channel.label} rate`}
          className="w-full"
        />
        <RateInput
          value={sliderValue}
          min={channel.min}
          max={channel.max}
          step={channel.step}
          disabled={bracketed}
          onCommit={onChange}
          aria-label={`${channel.label} rate, percent`}
        />
      </div>

      <div className="bg-fill-3 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", ACCENT_BG[channel.accent])}
          style={{ width: `${Math.min(sharePct, 100)}%` }}
        />
      </div>

      {bracketed && rate != null && (
        <div className="text-footnote flex flex-wrap items-center justify-between gap-2">
          <span className="text-label-secondary">Set by tax brackets</span>
          <FlattenBracketsButton channel={channel} topRate={rate} onConfirm={onFlatten} />
        </div>
      )}

      <div className="text-footnote flex items-center justify-between gap-2">
        <span className="text-label-secondary">Projected yield</span>
        <span className="text-label font-medium tabular-nums">
          {yieldValue != null ? formatCompactCurrency(yieldValue) : "Not set"}
        </span>
      </div>
    </Card>
  );
}

export function TaxesSection({ state }: { state: EditorState }) {
  const { countryId, applySaved } = useEditor();
  const notify = useNotify();
  const utils = api.useUtils();

  const saved = useMemo(() => readSavedRates(state.fiscalSystem), [state.fiscalSystem]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [flattened, setFlattened] = useState<Record<string, boolean>>({});

  const changedKeys = TAX_CHANNELS.map((ch) => ch.key).filter((key) => {
    const next = edits[key];
    if (next === undefined) return false;
    return next !== saved[key]?.rate || Boolean(flattened[key]);
  });
  const dirty = changedKeys.length > 0;
  useReportDirty("taxes", "Tax rates", dirty);

  const effectiveEdits = useMemo(
    () => Object.fromEntries(changedKeys.map((key) => [key, edits[key]!])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [changedKeys.join(","), edits]
  );
  const revenue = useMemo(() => nationalRevenue(state, effectiveEdits), [state, effectiveEdits]);

  const mutation = api.economics.updateFiscalSystem.useMutation({
    onSuccess: (_result, variables) => {
      applySaved((current) => ({
        ...current,
        fiscalSystem: {
          corporateTaxRates:
            variables.corporateTaxRates ?? current.fiscalSystem?.corporateTaxRates ?? null,
          personalIncomeTaxRates:
            variables.personalIncomeTaxRates ??
            current.fiscalSystem?.personalIncomeTaxRates ??
            null,
          salesTaxRate: variables.salesTaxRate ?? current.fiscalSystem?.salesTaxRate ?? null,
          exciseTaxRates: variables.exciseTaxRates ?? current.fiscalSystem?.exciseTaxRates ?? null,
          wealthTaxRate: variables.wealthTaxRate ?? current.fiscalSystem?.wealthTaxRate ?? null,
          taxEfficiency: current.fiscalSystem?.taxEfficiency ?? null,
        },
      }));
      setEdits({});
      setFlattened({});
      void utils.countries.invalidate();
      void utils.mycountry.getCountryDashboard.invalidate();
      void utils.government.invalidate();
      notify.success("Saved tax rates");
    },
    onError: (err: { message?: string }) => {
      notify.error("Could not save tax rates", err?.message ?? "Unknown error");
    },
  });

  const handleSave = () => {
    let nextExcise = state.fiscalSystem?.exciseTaxRates;
    const payload: FiscalRateUpdate = {};
    for (const key of changedKeys) {
      const update = fiscalUpdateForRate(key, edits[key]!, nextExcise);
      if (update.exciseTaxRates !== undefined) nextExcise = update.exciseTaxRates;
      Object.assign(payload, update);
    }
    mutation.mutate({ countryId, ...payload });
  };

  const reset = () => {
    setEdits({});
    setFlattened({});
  };

  return (
    <EditorSection
      id="taxes"
      title="National tax rates"
      description="Set the six national tax channels that fund your annual treasury. Rates set revenue and do not alter GDP or growth."
      icon={<Coins />}
    >
      <Card variant="well" content="data" padding="md">
        <div className="sm:divide-separator/60 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x">
          <Stat
            size="sm"
            label="Annual tax revenue"
            value={
              revenue.total != null ? `${formatCompactCurrency(revenue.total)} / yr` : "Not set"
            }
            hint={
              revenue.basis ? REVENUE_BASIS_NOTE[revenue.basis] : "Set a rate to project revenue"
            }
            className="sm:pr-4"
          />
          <Stat
            size="sm"
            label="Collection efficiency"
            value={
              revenue.taxEfficiency != null
                ? `${Math.round(revenue.taxEfficiency * 100)}%`
                : "Not recorded"
            }
            hint={
              revenue.taxEfficiency == null
                ? "Yields shown before collection losses"
                : "Applied to projected yields"
            }
            className="sm:px-4"
          />
          <Stat
            size="sm"
            label="Active tax channels"
            value={`${TAX_CHANNELS.filter((ch) => revenue.rates[ch.key] != null).length} of ${TAX_CHANNELS.length}`}
            hint="Channels with a configured rate"
            className="sm:pl-4"
          />
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {TAX_CHANNELS.map((ch) => (
          <TaxChannelWell
            key={ch.key}
            channel={ch}
            rate={revenue.rates[ch.key] ?? null}
            bracketed={Boolean(saved[ch.key]?.bracketed) && !flattened[ch.key]}
            yieldValue={revenue.yields.byChannel[ch.key] ?? null}
            totalYield={revenue.yields.total}
            onChange={(value) => setEdits((prev) => ({ ...prev, [ch.key]: value }))}
            onFlatten={(flatRate) => {
              setFlattened((prev) => ({ ...prev, [ch.key]: true }));
              setEdits((prev) => ({ ...prev, [ch.key]: flatRate }));
            }}
          />
        ))}
      </div>

      <SaveButton
        section="taxes"
        label="Save tax rates"
        dirty={dirty}
        invalid={false}
        pending={mutation.isPending}
        onSave={handleSave}
        onReset={reset}
      />
    </EditorSection>
  );
}
