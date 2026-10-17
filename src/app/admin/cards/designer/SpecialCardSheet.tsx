"use client";
/**
 * Edit one Special card: plain card fields, a realm, the bound toggle and, for a reward, the achievement that awards
 * it. Changing a saved card's rarity asks why, as the Library does.
 */
import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { lacksRarityReason } from "~/lib/cards/curation-limits";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { ValueSelect } from "~/components/ui/value-select";
import { RARITIES, RARITY_LABELS, type RarityValue } from "../shared/card-labels";

export type SpecialKind = "EVENT" | "ACHIEVEMENT_REWARD";

export interface SpecialCardDraft {
  id?: string;
  title: string;
  description: string;
  rarity: RarityValue;
  kind: SpecialKind;
  realmId: string;
  artwork: string;
  isBound: boolean;
  rewardAchievementKey: string;
}

export const EMPTY_DRAFT: SpecialCardDraft = {
  title: "",
  description: "",
  rarity: "RARE",
  kind: "EVENT",
  realmId: DEFAULT_REALM_ID,
  artwork: "",
  isBound: false,
  rewardAchievementKey: "",
};

const RARITY_OPTIONS = RARITIES.map((rarity) => [rarity, RARITY_LABELS[rarity]] as const);
const KIND_OPTIONS = [
  { value: "EVENT", label: "Event card" },
  { value: "ACHIEVEMENT_REWARD", label: "Achievement reward" },
] as const;

/**
 * Why the card cannot be saved yet, or null. The server checks the same rules; this says which one. `rarityReason` is
 * null unless the edit changes a saved card's rarity.
 */
function saveBlocker(form: SpecialCardDraft, rarityReason: string | null): string | null {
  if (form.title.trim().length < 2) return "Give the card a title of at least 2 characters.";
  if (form.kind === "ACHIEVEMENT_REWARD" && form.rewardAchievementKey === "")
    return "Choose the achievement that awards this card.";
  const artwork = form.artwork.trim();
  if (artwork !== "" && !/^https:\/\/\S+$/i.test(artwork)) return "Art is an https:// address.";
  if (rarityReason !== null && lacksRarityReason(rarityReason))
    return "Say why the rarity changes.";
  return null;
}

interface SpecialCardSheetProps {
  draft: SpecialCardDraft;
  /** Copies players hold. Any copy fixes the kind, binding and achievement, as the server does. */
  copies: number;
  onOpenChange: (open: boolean) => void;
}

export function SpecialCardSheet({ draft, copies, onOpenChange }: SpecialCardSheetProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [form, setForm] = useState(draft);
  const [reason, setReason] = useState("");
  const realms = api.cards.admin.overview.realms.useQuery();
  const achievements = api.cards.admin.designer.achievements.useQuery();
  const save = api.cards.admin.designer.save.useMutation({
    onSuccess: () => {
      notify.success("Special card saved");
      void utils.cards.admin.designer.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => notify.error("Card not saved", error.message),
  });
  const set = <K extends keyof SpecialCardDraft>(key: K, value: SpecialCardDraft[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const reward = form.kind === "ACHIEVEMENT_REWARD";
  const fixed = copies > 0;
  const rarityChanged = draft.id !== undefined && form.rarity !== draft.rarity;
  const blocker = saveBlocker(form, rarityChanged ? reason : null);
  const achievementOptions = (achievements.data ?? []).map(
    (achievement) => [achievement.id, achievement.title] as const
  );
  // A card keeps an achievement that has since retired, which the live list no longer offers
  const storedKey = draft.rewardAchievementKey;
  if (storedKey && !achievementOptions.some(([id]) => id === storedKey)) {
    achievementOptions.push([storedKey, storedKey]);
  }
  const submit = () =>
    save.mutate({
      id: form.id,
      title: form.title.trim(),
      description: form.description.trim(),
      rarity: form.rarity,
      kind: form.kind,
      realmId: form.realmId,
      artwork: form.artwork.trim() || null,
      isBound: reward || form.isBound,
      rewardAchievementKey: reward ? form.rewardAchievementKey : null,
      ...(rarityChanged ? { reason: reason.trim() } : {}),
    });

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="flex flex-col overflow-hidden">
        <SheetHeader className="pr-8">
          <SheetTitle>{form.id ? `Edit ${draft.title}` : "New Special card"}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
          <div className="space-y-1">
            <SegmentedControl
              aria-label="Kind"
              value={form.kind}
              disabled={fixed}
              onValueChange={(kind) => set("kind", kind)}
              options={KIND_OPTIONS}
            />
            {fixed && (
              <p className="text-footnote text-label-secondary">
                Players hold copies of this card, so its kind and binding are fixed.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="special-title">Title</Label>
            <Input
              id="special-title"
              maxLength={120}
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="special-description">Description</Label>
            <Textarea
              id="special-description"
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="special-rarity">Rarity</Label>
              <ValueSelect
                id="special-rarity"
                value={form.rarity}
                onValueChange={(rarity) => set("rarity", rarity)}
                options={RARITY_OPTIONS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="special-realm">Realm</Label>
              <ValueSelect
                id="special-realm"
                value={form.realmId}
                onValueChange={(realmId) => set("realmId", realmId)}
                options={(realms.data ?? []).map((realm) => [realm.id, realm.name] as const)}
              />
            </div>
          </div>
          {rarityChanged && (
            <div className="space-y-1">
              <Label htmlFor="special-reason">Why the rarity changes</Label>
              <Input
                id="special-reason"
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="special-art">Art URL</Label>
            <Input
              id="special-art"
              maxLength={2000}
              placeholder="https://"
              value={form.artwork}
              onChange={(event) => set("artwork", event.target.value)}
            />
          </div>
          {reward && (
            <div className="space-y-1">
              <Label htmlFor="special-achievement">Achievement</Label>
              <ValueSelect
                id="special-achievement"
                value={form.rewardAchievementKey}
                disabled={fixed}
                onValueChange={(key) => set("rewardAchievementKey", key)}
                options={achievementOptions}
                placeholder="Choose the achievement that awards it"
              />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                id="special-bound"
                checked={reward || form.isBound}
                disabled={reward || fixed}
                onCheckedChange={(isBound) => set("isBound", isBound)}
              />
              <Label htmlFor="special-bound">Bound</Label>
            </div>
            <p className="text-footnote text-label-secondary">
              {reward
                ? "Achievement rewards are always bound: they cannot be traded, listed, dusted or fused."
                : "Event cards can be traded unless you bind them."}
            </p>
          </div>
        </div>
        <SheetFooter className="border-separator shrink-0 border-t pt-4 sm:items-center">
          <p
            role="status"
            aria-live="polite"
            className="text-footnote text-label-secondary sm:mr-auto"
          >
            {blocker}
          </p>
          <Button disabled={save.isPending || blocker !== null} onClick={submit}>
            Save card
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
