"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface AddToShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The copies to add (one from the sheet, several from Mine's select mode). */
  ownershipIds: string[];
}

const cardCount = (count: number) => (count === 1 ? "1 card" : `${count} cards`);

/** What a showcase row says beside its name: its size, or why the picked cards do not fit. */
function roomLabel(itemCount: number, adding: number): { fits: boolean; label: string } {
  const room = SHOWCASE_LIMITS.items - itemCount;
  if (adding <= room) return { fits: true, label: cardCount(itemCount) };
  return { fits: false, label: room > 0 ? `Room for ${room}` : "Full" };
}

/** Puts copies into one of the player's showcases, or into a new private one. */
export function AddToShowcaseDialog({
  open,
  onOpenChange,
  ownershipIds,
}: AddToShowcaseDialogProps) {
  const [name, setName] = useState("");
  // The showcase being filled, for the confirmation; a new one has no id until it is created.
  const target = useRef({ id: "", name: "" });
  const utils = api.useUtils();
  const showcases = api.cards.listMyShowcases.useQuery(undefined, { enabled: open });

  const done = (added: number) => {
    const { id, name: showcaseName } = target.current;
    vaultNotify.success(
      added === 0 ? "Already in this showcase" : `Added ${cardCount(added)}`,
      showcaseName
    );
    void utils.cards.listMyShowcases.invalidate();
    void utils.cards.getShowcase.invalidate({ showcaseId: id });
    void utils.cards.getMyDisplay.invalidate();
    setName("");
    onOpenChange(false);
  };
  const add = api.cards.addToShowcase.useMutation({
    onSuccess: (result) => done(result.added),
    onError: (error) => vaultNotify.error(error.message),
  });
  const addTo = (id: string, showcaseName: string) => {
    target.current = { id, name: showcaseName };
    add.mutate({ showcaseId: id, ownershipIds });
  };
  const create = api.cards.createShowcase.useMutation({
    onSuccess: (created) => {
      // Listed at once, so a failed add leaves the new showcase to pick rather than to make again.
      void utils.cards.listMyShowcases.invalidate();
      addTo(created.id, target.current.name);
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  const busy = add.isPending || create.isPending;
  const count = ownershipIds.length;
  const list = showcases.data ?? [];
  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    target.current = { id: "", name: trimmed };
    create.mutate({ name: trimmed, isPublic: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-title-3">Add to a showcase</DialogTitle>
          <DialogDescription>{`Pick a showcase for ${cardCount(count)}.`}</DialogDescription>
        </DialogHeader>
        {showcases.isLoading ? (
          <Skeleton className="rounded-row h-24" />
        ) : list.length === 0 ? (
          <p className="text-callout text-label-secondary">
            No showcases yet. Name one to start it.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {list.map((showcase) => {
              const room = roomLabel(showcase.itemCount, count);
              return (
                <li key={showcase.id}>
                  <Button
                    variant="secondary"
                    className="w-full justify-between"
                    disabled={busy || !room.fits}
                    aria-label={`Add to ${showcase.name}`}
                    onClick={() => addTo(showcase.id, showcase.name)}
                  >
                    <span className="truncate">{showcase.name}</span>
                    <span className="text-label-secondary tabular-nums">{room.label}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {list.length >= SHOWCASE_LIMITS.perPlayer ? (
          <p className="text-footnote text-label-secondary">
            {`You have ${SHOWCASE_LIMITS.perPlayer} showcases, the most you can keep.`}
          </p>
        ) : (
          <form className="space-y-2" onSubmit={onCreate}>
            <Label htmlFor="new-showcase-name">New showcase name</Label>
            <div className="flex gap-2">
              <Input
                id="new-showcase-name"
                value={name}
                maxLength={SHOWCASE_LIMITS.name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Favourites"
              />
              <Button type="submit" disabled={busy || name.trim() === ""}>
                <Plus />
                Create and add
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
