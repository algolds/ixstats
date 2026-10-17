"use client";
/** Create or edit a pack: basics, odds and pool (PackPoolFields), guarantee, limits and expiry. */
import { useState } from "react";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { PackType } from "~/lib/cards/enums";
import { PackOddsSchema } from "~/lib/cards/pack-odds";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { ValueSelect } from "~/components/ui/value-select";
import { RARITIES, RARITY_LABELS, type RarityValue } from "../shared/card-labels";
import { PackPoolFields } from "./PackPoolFields";

type Pack = RouterOutputs["cards"]["admin"]["packs"]["list"][number];
type PackInput = RouterInputs["cards"]["admin"]["packs"]["save"];
/** The editor's values. The kind is null while a pack stored with a kind the editor does not know waits for one. */
type PackForm = Omit<PackInput, "packType"> & { packType: PackInput["packType"] | null };

const PACK_TYPES = Object.values(PackType);
const PACK_TYPE_OPTIONS = PACK_TYPES.map(
  (type) => [type, type.charAt(0) + type.slice(1).toLowerCase()] as const
);
const GUARANTEE_OPTIONS: readonly (readonly [RarityValue | "none", string])[] = [
  ["none", "None"],
  ...RARITIES.map((rarity) => [rarity, RARITY_LABELS[rarity]] as const),
];
const MAX_PRICE = 1_000_000;
const MAX_CARDS = 20;

/** A new pack: the seeded odds, off sale until the admin puts it on. */
const NEW_PACK: PackForm = {
  id: undefined,
  name: "",
  description: null,
  artwork: null,
  packType: "BASIC",
  priceCredits: 100,
  cardCount: 5,
  guaranteedRarity: null,
  isActive: false,
  odds: {
    commonOdds: 65,
    uncommonOdds: 25,
    rareOdds: 7,
    ultraRareOdds: 2,
    epicOdds: 0.9,
    legendaryOdds: 0.1,
  },
  season: null,
  cardType: null,
  pool: { realmIds: [], categories: [], cardTypes: [] },
  limitedQuantity: null,
  purchaseLimit: null,
  expiresAt: null,
};

/** The editor's starting values. Kind and guarantee are stored as strings, so each keeps only a value it knows. */
function packFormOf(pack: Pack | null): PackForm {
  if (!pack) return NEW_PACK;
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    artwork: pack.artwork,
    packType: PACK_TYPES.find((type) => type === pack.packType) ?? null,
    priceCredits: pack.priceCredits,
    cardCount: pack.cardCount,
    guaranteedRarity: RARITIES.find((rarity) => rarity === pack.guaranteedRarity) ?? null,
    isActive: pack.isActive,
    odds: {
      commonOdds: pack.commonOdds,
      uncommonOdds: pack.uncommonOdds,
      rareOdds: pack.rareOdds,
      ultraRareOdds: pack.ultraRareOdds,
      epicOdds: pack.epicOdds,
      legendaryOdds: pack.legendaryOdds,
    },
    season: pack.season,
    cardType: pack.cardType,
    pool: pack.pool,
    limitedQuantity: pack.limitedQuantity,
    purchaseLimit: pack.purchaseLimit,
    expiresAt: pack.expiresAt,
  };
}

const isCount = (value: number, max = Number.MAX_SAFE_INTEGER) =>
  Number.isInteger(value) && value >= 1 && value <= max;

/** Why the pack cannot be saved yet, or null. The server checks the same rules; this says which one. */
function saveBlocker(form: PackForm): string | null {
  if (form.name.trim() === "") return "Give the pack a name.";
  if (!form.packType) return "Choose the pack's kind.";
  if (!isCount(form.priceCredits, MAX_PRICE))
    return `Set a whole-number price from 1 to ${MAX_PRICE.toLocaleString("en")} IxC.`;
  if (!isCount(form.cardCount, MAX_CARDS)) return `A pack holds 1 to ${MAX_CARDS} cards.`;
  if ([form.limitedQuantity, form.purchaseLimit].some((limit) => limit !== null && !isCount(limit)))
    return "Total stock and the per-player limit are blank or a whole number of at least 1.";
  if (!PackOddsSchema.safeParse(form.odds).success)
    return "Each rarity's odds are 0 to 100%, adding up to 100%.";
  return null;
}

const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text));
/** The date field's day, read and written as the end of that day in UTC. */
const dayOf = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");
const endOfDay = (day: string) => (day ? new Date(`${day}T23:59:59Z`) : null);

interface PackEditorSheetProps {
  pack: Pack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackEditorSheet({ pack, open, onOpenChange }: PackEditorSheetProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [form, setForm] = useState<PackForm>(() => packFormOf(pack));
  const save = api.cards.admin.packs.save.useMutation({
    onSuccess: () => {
      notify.success("Pack saved");
      void utils.cards.admin.packs.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => notify.error("Pack not saved", error.message),
  });
  const set = <K extends keyof PackForm>(key: K, value: PackForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const blocker = saveBlocker(form);
  const submit = () => {
    if (form.packType && blocker === null) save.mutate({ ...form, packType: form.packType });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        size="wide"
        aria-describedby={undefined}
        className="flex flex-col overflow-hidden"
      >
        <SheetHeader>
          <SheetTitle>{pack ? `Edit ${pack.name}` : "New pack"}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4 pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pack-name">Name</Label>
              <Input
                id="pack-name"
                maxLength={100}
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pack-type">Kind</Label>
              <ValueSelect<PackInput["packType"] | "">
                id="pack-type"
                value={form.packType ?? ""}
                placeholder="Choose a kind"
                onValueChange={(value) => set("packType", value || null)}
                options={PACK_TYPE_OPTIONS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pack-price">Price (IxC)</Label>
              <Input
                id="pack-price"
                type="number"
                min={1}
                max={MAX_PRICE}
                step={1}
                value={form.priceCredits}
                onChange={(event) => set("priceCredits", Number(event.target.value))}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pack-count">Cards per pack</Label>
              <Input
                id="pack-count"
                type="number"
                min={1}
                max={MAX_CARDS}
                step={1}
                value={form.cardCount}
                onChange={(event) => set("cardCount", Number(event.target.value))}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pack-description">Description</Label>
              <Input
                id="pack-description"
                maxLength={500}
                value={form.description ?? ""}
                onChange={(event) => set("description", event.target.value || null)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pack-artwork">Art URL</Label>
              <Input
                id="pack-artwork"
                maxLength={500}
                placeholder="/images/packs/my-pack.svg"
                value={form.artwork ?? ""}
                onChange={(event) => set("artwork", event.target.value || null)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="pack-guarantee">Guaranteed rarity</Label>
              <ValueSelect<RarityValue | "none">
                id="pack-guarantee"
                value={form.guaranteedRarity ?? "none"}
                onValueChange={(value) => set("guaranteedRarity", value === "none" ? null : value)}
                options={GUARANTEE_OPTIONS}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={form.guaranteedRarity === null}
              onClick={() => set("guaranteedRarity", null)}
            >
              Clear guarantee
            </Button>
          </div>

          <PackPoolFields
            odds={form.odds}
            onOddsChange={(odds) => set("odds", odds)}
            pool={form.pool}
            onPoolChange={(pool) => set("pool", pool)}
            cardType={form.cardType}
            season={form.season}
          />

          <fieldset className="space-y-3">
            <legend className="text-headline text-label">Limits</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="pack-stock">Total stock</Label>
                <Input
                  id="pack-stock"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Unlimited"
                  value={form.limitedQuantity ?? ""}
                  onChange={(event) => set("limitedQuantity", numberOrNull(event.target.value))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pack-limit">Per player</Label>
                <Input
                  id="pack-limit"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="No limit"
                  value={form.purchaseLimit ?? ""}
                  onChange={(event) => set("purchaseLimit", numberOrNull(event.target.value))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pack-expires">Off sale after (UTC)</Label>
                <Input
                  id="pack-expires"
                  type="date"
                  value={dayOf(form.expiresAt)}
                  onChange={(event) => set("expiresAt", endOfDay(event.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="pack-active"
                checked={form.isActive}
                onCheckedChange={(checked) => set("isActive", checked)}
              />
              <Label htmlFor="pack-active">On sale</Label>
            </div>
          </fieldset>
        </div>
        <SheetFooter className="border-separator shrink-0 border-t pt-4 sm:items-center">
          {blocker && (
            <p className="text-footnote text-label-secondary sm:mr-auto" aria-live="polite">
              {blocker}
            </p>
          )}
          <Button disabled={save.isPending || blocker !== null} onClick={submit}>
            Save pack
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
