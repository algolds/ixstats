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
import { useShowcaseRefresh } from "~/hooks/useShowcaseRefresh";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import { focusedElement, refocus } from "~/lib/utils/focus";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface AddToShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The copies to add (one from the sheet, several from Mine's select mode). */
  ownershipIds: string[];
  /** Called once the copies are in a showcase, never on a dismissal: Mine then leaves select mode. */
  onAdded?: () => void;
}

interface ShowcaseChoice {
  id: string;
  name: string;
  itemCount: number;
}

const cardCount = (count: number) => (count === 1 ? "1 card" : `${count} cards`);

/** What a showcase row says beside its name: its size, or why the picked cards do not fit. */
function roomLabel(itemCount: number, adding: number): { fits: boolean; label: string } {
  const room = SHOWCASE_LIMITS.items - itemCount;
  if (adding <= room) return { fits: true, label: cardCount(itemCount) };
  return { fits: false, label: room > 0 ? `Room for ${room}` : "Full" };
}

/** The player's showcases to pick from, or why there are none to show. */
function ShowcaseChoices({
  query,
  adding,
  busy,
  onPick,
}: {
  query: { data?: ShowcaseChoice[]; isLoading: boolean; isError: boolean; refetch: () => void };
  adding: number;
  busy: boolean;
  onPick: (showcase: ShowcaseChoice) => void;
}) {
  if (query.isLoading) return <Skeleton className="rounded-row h-24" />;
  // A failed refresh keeps the rows it already has; only a list that never loaded says so.
  if (query.isError && !query.data) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-label-secondary">Your showcases did not load.</p>
        <Button size="sm" variant="secondary" onClick={query.refetch}>
          Try again
        </Button>
      </div>
    );
  }
  const list = query.data ?? [];
  if (list.length === 0) {
    return (
      <p className="text-callout text-label-secondary">No showcases yet. Name one to start it.</p>
    );
  }
  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto">
      {list.map((showcase) => {
        const room = roomLabel(showcase.itemCount, adding);
        return (
          <li key={showcase.id}>
            <Button
              variant="secondary"
              className="w-full justify-between"
              disabled={busy || !room.fits}
              aria-label={
                room.fits ? `Add to ${showcase.name}` : `Add to ${showcase.name}, ${room.label}`
              }
              onClick={() => onPick(showcase)}
            >
              <span className="truncate">{showcase.name}</span>
              <span className="text-label-secondary tabular-nums">{room.label}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Puts copies into one of the player's showcases, or into a new private one. */
export function AddToShowcaseDialog({
  open,
  onOpenChange,
  ownershipIds,
  onAdded,
}: AddToShowcaseDialogProps) {
  const [name, setName] = useState("");
  // While the dialog animates out, the caller may already have let go of the cards: keep saying what it was adding.
  const [ids, setIds] = useState(ownershipIds);
  if (open && ids !== ownershipIds) setIds(ownershipIds);
  // The showcase being filled, for the confirmation; a new one has no id until it is created.
  const target = useRef({ id: "", name: "" });
  // No Radix trigger opens this dialog, so it gives focus back to what had it.
  const opener = useRef<HTMLElement | null>(null);
  const utils = api.useUtils();
  const refresh = useShowcaseRefresh();
  const showcases = api.cards.listMyShowcases.useQuery(undefined, { enabled: open });

  const done = (added: number) => {
    const { id, name: showcaseName } = target.current;
    vaultNotify.success(
      added === 0 ? "Already in this showcase" : `Added ${cardCount(added)}`,
      showcaseName
    );
    refresh(id);
    setName("");
    onOpenChange(false);
    onAdded?.();
  };
  const add = api.cards.addToShowcase.useMutation({
    onSuccess: (result) => done(result.added),
    onError: (error) => vaultNotify.error(error.message),
  });
  const addTo = (id: string, showcaseName: string) => {
    target.current = { id, name: showcaseName };
    add.mutate({ showcaseId: id, ownershipIds: ids });
  };
  const create = api.cards.createShowcase.useMutation({
    onSuccess: (created) => {
      // The new showcase is listed and the name cleared at once, so a failed add leaves its row to retry from,
      // never a second press that makes another.
      setName("");
      void utils.cards.listMyShowcases.invalidate();
      addTo(created.id, target.current.name);
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  const busy = add.isPending || create.isPending;
  const showcaseCount = showcases.data?.length ?? 0;
  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    target.current = { id: "", name: trimmed };
    create.mutate({ name: trimmed, isPublic: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onOpenAutoFocus={() => {
          opener.current = focusedElement();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          refocus(opener.current);
          opener.current = null;
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-title-3">Add to a showcase</DialogTitle>
          <DialogDescription>{`Pick a showcase for ${cardCount(ids.length)}.`}</DialogDescription>
        </DialogHeader>
        <ShowcaseChoices
          query={{
            data: showcases.data,
            isLoading: showcases.isLoading,
            isError: showcases.isError,
            refetch: () => void showcases.refetch(),
          }}
          adding={ids.length}
          busy={busy}
          onPick={(showcase) => addTo(showcase.id, showcase.name)}
        />
        {showcaseCount >= SHOWCASE_LIMITS.perPlayer ? (
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
