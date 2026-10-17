"use client";

import { useState, type ReactNode } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useDebounce } from "~/hooks/useDebounce";
import { useShowcaseRefresh } from "~/hooks/useShowcaseRefresh";
import { cardCount } from "~/lib/cards/curation-limits";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MinePage } from "~/lib/cards/hub/mine";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardGrid } from "./CardGrid";

/** Mine's largest page; a search finds the copies past it. */
const PAGE = 120;

interface ShowcasePickerDialogProps {
  showcaseId: string;
  /** Copies already in the showcase: left out of the picker, and counted against its room. */
  existing: ReadonlySet<string>;
  /** The button that opens the picker; focus goes back to it when the picker closes. */
  trigger: ReactNode;
}

const roomLabel = (room: number) => (room === 1 ? "1 more card" : `${room} more cards`);

/** Picks copies from Mine to add to a showcase. Bound copies may go on a showcase too. */
export function ShowcasePickerDialog({ showcaseId, existing, trigger }: ShowcasePickerDialogProps) {
  const [open, setOpen] = useState(false);
  const room = SHOWCASE_LIMITS.items - existing.size;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-title-3">Add cards</DialogTitle>
          <DialogDescription>{`Room for ${roomLabel(room)}.`}</DialogDescription>
        </DialogHeader>
        {/* Inside the content, so the search and the picks start over each time the picker opens. */}
        <PickerBody
          showcaseId={showcaseId}
          existing={existing}
          room={room}
          onAdded={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  showcaseId,
  existing,
  room,
  onAdded,
}: {
  showcaseId: string;
  existing: ReadonlySet<string>;
  room: number;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  // Picks stay across searches, so cards found by different searches go in together.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const searched = useDebounce(search.trim(), 300);
  const refresh = useShowcaseRefresh();
  const mine = api.cards.listMine.useQuery(
    { search: searched || undefined, sort: "acquired", limit: PAGE },
    // A new search keeps the cards on screen until its page arrives.
    { placeholderData: keepPreviousData }
  );
  const add = api.cards.addToShowcase.useMutation({
    onSuccess: () => {
      refresh(showcaseId);
      onAdded();
    },
    onError: (error) => vaultNotify.error(error.message),
  });
  const toggle = (face: CardFaceData) => {
    const id = face.copy?.ownershipId;
    if (!id) return;
    setPicked((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const over = picked.size > room;

  return (
    <>
      <SearchField
        aria-label="Search your cards"
        placeholder="Search your cards"
        value={search}
        onValueChange={setSearch}
      />
      <PickerCards
        query={{
          data: mine.data,
          isLoading: mine.isLoading,
          isError: mine.isError,
          refetch: () => void mine.refetch(),
        }}
        searching={searched !== ""}
        existing={existing}
        picked={picked}
        onToggle={toggle}
      />
      {over && (
        <p className="text-footnote text-warning-ink">{`Too many picked. This showcase has room for ${roomLabel(room)}.`}</p>
      )}
      <DialogFooter>
        <Button
          disabled={picked.size === 0 || over || add.isPending}
          onClick={() => add.mutate({ showcaseId, ownershipIds: [...picked] })}
        >
          {`Add ${cardCount(picked.size)}`}
        </Button>
      </DialogFooter>
    </>
  );
}

function PickerCards({
  query,
  searching,
  existing,
  picked,
  onToggle,
}: {
  query: { data?: MinePage; isLoading: boolean; isError: boolean; refetch: () => void };
  searching: boolean;
  existing: ReadonlySet<string>;
  picked: ReadonlySet<string>;
  onToggle: (face: CardFaceData) => void;
}) {
  if (query.isLoading) return <Skeleton className="rounded-card h-48" />;
  // A failed refresh keeps the cards it already has; only a list that never loaded says so.
  if (query.isError && !query.data) {
    return (
      <EmptyState
        compact
        title="Your cards did not load"
        action={
          <Button variant="secondary" onClick={query.refetch}>
            Try again
          </Button>
        }
      />
    );
  }
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const faces = rows
    .map((row) => row.face)
    .filter((face) => face.copy && !existing.has(face.copy.ownershipId));
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title={searching ? "No cards match this search" : "You have no cards yet"}
      />
    );
  }
  if (faces.length === 0) {
    return <EmptyState compact title="These cards are already in this showcase" />;
  }
  return (
    <>
      <CardGrid faces={faces} onOpen={onToggle} selected={picked} label="Your cards" />
      {total > rows.length && (
        <p className="text-footnote text-label-secondary">{`Showing your newest ${rows.length} of ${total} cards. Search to find the rest.`}</p>
      )}
    </>
  );
}
