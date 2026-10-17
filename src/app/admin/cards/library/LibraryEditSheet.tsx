"use client";
/** Edit one card: its title, description and art, its rarity (with a reason, audited) and whether it is hidden. */
import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { ValueSelect } from "~/components/ui/value-select";
import { RARITIES, RARITY_LABELS, type RarityValue } from "../shared/card-labels";

export type LibraryRow = RouterOutputs["cards"]["admin"]["library"]["list"]["rows"][number];

const RARITY_OPTIONS = RARITIES.map((rarity) => [rarity, RARITY_LABELS[rarity]] as const);

/** Why Compliance, not the Library, owns this card's art and visibility; null when it does not. */
function complianceHold(card: LibraryRow): string | null {
  if (card._count.takedowns > 0) return "A takedown hides this art. Restore it from Compliance.";
  if (card.artLicence?.status === "RESTRICTED") {
    return "This art's licence is restricted. Change it from Compliance.";
  }
  return null;
}

interface Draft {
  title: string;
  description: string;
  artwork: string;
  rarity: RarityValue;
  retired: boolean;
  reason: string;
}

/** Why the card cannot be saved yet, or null. The server checks the same rules; this says which one. */
function saveBlocker(card: LibraryRow, draft: Draft): string | null {
  if (draft.title.trim() === "") return "Give the card a title.";
  const artwork = draft.artwork.trim();
  if (artwork !== "" && artwork !== card.artwork && !/^https:\/\/\S+$/i.test(artwork)) {
    return "Art is an https:// address.";
  }
  if (draft.rarity !== card.rarity && draft.reason.trim().length < 3) {
    return "Say why the rarity changes.";
  }
  return null;
}

export function LibraryEditSheet({
  card,
  onOpenChange,
}: {
  card: LibraryRow;
  onOpenChange: (open: boolean) => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState<Draft>({
    title: card.title,
    description: card.description ?? "",
    artwork: card.artwork ?? "",
    rarity: card.rarity,
    retired: card.isRetired,
    reason: "",
  });
  const update = api.cards.admin.library.update.useMutation({
    onSuccess: () => {
      notify.success("Card saved");
      void utils.cards.admin.library.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      notify.error("Card not saved", error.message);
      // The card changed since this sheet opened: read the list again, so reopening it shows the card as it is.
      if (error.data?.code === "CONFLICT") void utils.cards.admin.library.list.invalidate();
    },
  });
  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));
  const hold = complianceHold(card);
  const rarityChanged = draft.rarity !== card.rarity;
  const blocker = saveBlocker(card, draft);
  const submit = () =>
    update.mutate({
      cardId: card.id,
      title: draft.title.trim(),
      description: draft.description.trim(),
      artwork: draft.artwork.trim() || null,
      rarity: draft.rarity,
      retired: draft.retired,
      ...(rarityChanged ? { reason: draft.reason.trim() } : {}),
      expected: { artwork: card.artwork, isRetired: card.isRetired, rarity: card.rarity },
    });

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="flex flex-col overflow-hidden">
        <SheetHeader className="pr-8">
          <SheetTitle>{`Edit ${card.title}`}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
          <div className="space-y-1">
            <Label htmlFor="library-title">Title</Label>
            <Input
              id="library-title"
              maxLength={200}
              value={draft.title}
              onChange={(event) => set("title")(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="library-description">Description</Label>
            <Textarea
              id="library-description"
              rows={3}
              maxLength={2000}
              value={draft.description}
              onChange={(event) => set("description")(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="library-art">Art URL</Label>
            <Input
              id="library-art"
              maxLength={2000}
              placeholder="https://"
              value={draft.artwork}
              disabled={hold !== null}
              onChange={(event) => set("artwork")(event.target.value)}
            />
            {hold && <p className="text-footnote text-label-secondary">{hold}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="library-rarity">Rarity</Label>
            <ValueSelect
              id="library-rarity"
              value={draft.rarity}
              onValueChange={set("rarity")}
              options={RARITY_OPTIONS}
            />
          </div>
          {rarityChanged && (
            <div className="space-y-1">
              <Label htmlFor="library-reason">Why the rarity changes</Label>
              <Input
                id="library-reason"
                maxLength={500}
                value={draft.reason}
                onChange={(event) => set("reason")(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                id="library-hidden"
                checked={draft.retired}
                disabled={hold !== null}
                onCheckedChange={set("retired")}
              />
              <Label htmlFor="library-hidden">Hidden from packs and Explore</Label>
            </div>
            <p className="text-footnote text-label-secondary">Players keep the copies they own.</p>
            {card.rewardAchievementKey && (
              <p className="text-footnote text-label-secondary">
                Players who unlock this achievement while the card is hidden get no card.
              </p>
            )}
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
          <Button disabled={update.isPending || blocker !== null} onClick={submit}>
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
