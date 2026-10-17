"use client";
/** Economy: card values, market and capacity, bonuses and Loreward payouts, rarity tables, daily imports. */
import { Coins, Gift, Shop } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  BONUS_FIELDS,
  BONUS_SWITCH_FIELD,
  CARD_VALUE_FIELDS,
  MARKET_FIELDS,
  floorsProblem,
} from "~/lib/cards/economy-fields";
import { DailyImportsCard } from "./DailyImportsCard";
import { LorewardPayoutsCard } from "./LorewardPayoutsCard";
import { NumberConfigCard } from "./NumberConfigCard";
import { RarityThresholdsCard } from "./RarityThresholdsCard";

export function EconomyTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const settings = api.cards.admin.economy.get.useQuery();
  const refresh = () => void utils.cards.admin.economy.get.invalidate();
  const saved = (title: string) => () => {
    notify.success(title);
    refresh();
  };
  const failed = (title: string) => (error: { message: string }) =>
    notify.error(title, error.message);
  const saveValues = api.cards.admin.economy.saveValues.useMutation({
    onSuccess: ({ updated }) => {
      refresh();
      if (updated === null) {
        notify.error(
          "Cards not revalued",
          "The card values are saved. Revalue every card to try again."
        );
      } else notify.success(`Card values saved, ${updated.toLocaleString()} cards changed value`);
    },
    onError: failed("Card values not saved"),
  });
  const recompute = api.cards.admin.economy.recomputeValues.useMutation({
    onSuccess: ({ updated }) =>
      notify.success(`Every card revalued, ${updated.toLocaleString()} changed value`),
    onError: failed("Cards not revalued"),
  });
  const saveMarket = api.cards.admin.economy.saveMarket.useMutation({
    onSuccess: saved("Market saved"),
    onError: failed("Market not saved"),
  });
  const saveBonuses = api.cards.admin.economy.saveBonuses.useMutation({
    onSuccess: saved("Bonuses saved"),
    onError: failed("Bonuses not saved"),
  });

  const data = settings.data;
  if (settings.isError) {
    return (
      <p role="alert" className="text-destructive text-footnote">
        The economy settings did not load. Reload the page to try again.
      </p>
    );
  }
  if (!data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <NumberConfigCard
        id="values"
        title="Card values"
        icon={<Coins />}
        description="A card is worth its rarity floor times its type multiplier, and a NationStates card at least its bank value times its multiplier. Saving revalues every card."
        fields={CARD_VALUE_FIELDS}
        initial={data.values}
        saveLabel="Save card values"
        pending={saveValues.isPending || recompute.isPending}
        onSave={(changed) => saveValues.mutate(changed)}
        check={(values) => floorsProblem(values)}
        action={
          <Button
            variant="ghost"
            disabled={saveValues.isPending || recompute.isPending}
            onClick={() => recompute.mutate()}
          >
            Revalue every card
          </Button>
        }
      />
      <NumberConfigCard
        id="market"
        title="Market and capacity"
        icon={<Shop />}
        fields={MARKET_FIELDS}
        initial={data.market}
        saveLabel="Save market"
        pending={saveMarket.isPending}
        onSave={(changed) => saveMarket.mutate(changed)}
      />
      <NumberConfigCard
        id="bonuses"
        title="Bonuses (IxC)"
        icon={<Gift />}
        fields={BONUS_FIELDS}
        initial={data.bonuses}
        saveLabel="Save bonuses"
        pending={saveBonuses.isPending}
        onSave={(changed) => saveBonuses.mutate(changed)}
      >
        <div className="flex items-center gap-3">
          <Switch
            id="bonuses-enabled"
            checked={data.bonuses.enabled > 0}
            disabled={saveBonuses.isPending}
            onCheckedChange={(on) => saveBonuses.mutate({ enabled: on ? 1 : 0 })}
          />
          <Label htmlFor="bonuses-enabled">{BONUS_SWITCH_FIELD.label}</Label>
        </div>
        <p className="text-footnote text-label-secondary">
          Saved at once. While it is off, no bonus here and no Loreward payout is paid.
        </p>
      </NumberConfigCard>
      <LorewardPayoutsCard initial={data.lorewardPayouts} />
      <RarityThresholdsCard initial={data.rarityThresholds} />
      <DailyImportsCard initial={data.dailyImports} />
    </div>
  );
}
