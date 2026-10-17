"use client";
/**
 * The Library: every card, filtered by realm, type, rarity and source, with an edit sheet and bulk hide. Hiding takes
 * a card out of packs and Explore; players keep their copies.
 */
import { useState } from "react";
import { Book } from "iconoir-react";
import { api, type RouterInputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";
import { cardSourceLabel, parseCardWikiSource } from "~/lib/cards/card-sources";
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  CARD_TYPE_LABELS,
  RARITY_LABELS,
  REVIEW_STATE_LABELS,
  labelOf,
} from "../shared/card-labels";
import { ReasonDialog } from "../shared/ReasonDialog";
import { EMPTY_FILTER, LibraryFilters, type LibraryFilterState } from "./LibraryFilters";
import { LibraryEditSheet, type LibraryRow } from "./LibraryEditSheet";

const PAGE_SIZE = 50;

type Filter = RouterInputs["cards"]["admin"]["library"]["list"]["filter"];
/** What a bulk change acts on, fixed when its dialog opens: the filter and the read it showed. */
type BulkTarget = Omit<RouterInputs["cards"]["admin"]["library"]["bulkSetRetired"], "reason">;

/** The form's choices as the server's filter; "any" and "all" become absent keys. */
function filterOf(state: LibraryFilterState): Filter {
  return {
    realmId: state.realmId === "any" ? undefined : state.realmId,
    cardType: state.cardType === "any" ? undefined : state.cardType,
    rarity: state.rarity === "any" ? undefined : state.rarity,
    source: state.source === "any" ? undefined : state.source,
    show: state.show === "all" ? undefined : state.show,
    search: state.search.trim() || undefined,
  };
}

const cardCount = (count: number) => `${count.toLocaleString()} ${count === 1 ? "card" : "cards"}`;

const BULK_COPY = {
  hide: {
    verb: "Hide",
    description:
      "They leave packs and Explore, and players keep their copies. Achievement reward cards stay: hide one from its own edit.",
  },
  unhide: {
    verb: "Unhide",
    description:
      "They return to packs and Explore. Cards whose art a takedown or a restricted licence hides stay hidden: change those from Compliance.",
  },
} as const;

/** The card's type, source wiki and, when not approved, its review state. */
function rowDetails(row: LibraryRow): string {
  const source = parseCardWikiSource(row.wikiSource);
  return [
    labelOf(CARD_TYPE_LABELS, row.cardType),
    source ? cardSourceLabel(source) : null,
    row.reviewState === "APPROVED" ? null : labelOf(REVIEW_STATE_LABELS, row.reviewState),
  ]
    .filter(Boolean)
    .join(" · ");
}

function LibraryTable({ rows, onEdit }: { rows: LibraryRow[]; onEdit: (row: LibraryRow) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead>Realm</TableHead>
          <TableHead>Rarity</TableHead>
          <TableHead className="text-right">Copies</TableHead>
          <TableHead>
            <span className="sr-only">Edit</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="flex flex-wrap items-center gap-2">
                {row.title}
                {row.isRetired && <Badge variant="outline">Hidden</Badge>}
                {row._count.takedowns > 0 && <Badge variant="warning">Art hidden</Badge>}
                {row.isBound && <Badge variant="secondary">Bound</Badge>}
              </span>
              <span className="text-footnote text-label-secondary block">{rowDetails(row)}</span>
            </TableCell>
            <TableCell>{row.realm.name}</TableCell>
            <TableCell>{labelOf(RARITY_LABELS, row.rarity)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row._count.CardOwnership.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit ${row.title}`}
                onClick={() => onEdit(row)}
              >
                Edit
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Pager({
  offset,
  total,
  onOffset,
}: {
  offset: number;
  total: number;
  onOffset: (offset: number) => void;
}) {
  const last = Math.min(offset + PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-footnote text-label-secondary tabular-nums">
        {total === 0
          ? "No cards"
          : `${(offset + 1).toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0}
          onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={last >= total}
          onClick={() => onOffset(offset + PAGE_SIZE)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function LibraryTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [state, setState] = useState(EMPTY_FILTER);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<LibraryRow | null>(null);
  const bulk = useDialogTarget<BulkTarget>();
  const filter = filterOf(state);
  const list = api.cards.admin.library.list.useQuery({ filter, offset, limit: PAGE_SIZE });
  const bulkSet = api.cards.admin.library.bulkSetRetired.useMutation({
    onSuccess: (result, asked) => {
      notify.success(`${cardCount(result.count)} ${asked.retired ? "hidden" : "unhidden"}`);
      bulk.close();
      void utils.cards.admin.library.list.invalidate();
    },
    onError: (error) => {
      notify.error("Nothing changed", error.message);
      // The cards changed under the read: read them again, so the next try sees them as they are.
      if (error.data?.code === "CONFLICT") void utils.cards.admin.library.list.invalidate();
    },
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const asOf = list.data?.asOf;
  // What each bulk change would change, which is what it is capped and confirmed by
  const hideable = list.data?.hideable ?? 0;
  const unhideable = list.data?.unhideable ?? 0;
  const narrowed = Object.values(filter).some((value) => value !== undefined);
  const canChange = (count: number) => narrowed && count > 0 && count <= MAX_FILTER_REVIEW;
  const overCap = [
    hideable > MAX_FILTER_REVIEW ? "hide" : null,
    unhideable > MAX_FILTER_REVIEW ? "unhide" : null,
  ]
    .filter(Boolean)
    .join(" or ");
  const openBulk = (retired: boolean) => {
    if (asOf) bulk.open({ filter, retired, asOf, expected: retired ? hideable : unhideable });
  };
  const changeFilter = (next: LibraryFilterState) => {
    setState(next);
    setOffset(0);
  };
  const copy = bulk.shown?.retired === false ? BULK_COPY.unhide : BULK_COPY.hide;
  const shownCount = bulk.shown?.expected ?? 0;

  return (
    <Card content="data">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pt-5">
        <CardTitle icon={<Book />}>Library</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!canChange(hideable)}
            onClick={() => openBulk(true)}
          >
            Hide {cardCount(hideable)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canChange(unhideable)}
            onClick={() => openBulk(false)}
          >
            Unhide {cardCount(unhideable)}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <LibraryFilters value={state} onChange={changeFilter} />
        {narrowed && overCap && (
          <p className="text-footnote text-label-secondary">
            Narrow the filter to {overCap} these cards: at most {MAX_FILTER_REVIEW.toLocaleString()}{" "}
            cards change at once.
          </p>
        )}
        {list.isError ? (
          <p role="alert" className="text-destructive text-footnote">
            The Library did not load. {list.error.message}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            title="No cards match"
            message="Change the filters to see more cards."
          />
        ) : (
          <LibraryTable rows={rows} onEdit={setEditing} />
        )}
        <Pager offset={offset} total={total} onOffset={setOffset} />
      </CardContent>
      {editing && (
        <LibraryEditSheet
          key={editing.id}
          card={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
      <ReasonDialog
        open={bulk.target !== null}
        onOpenChange={(open) => !open && bulk.close()}
        title={`${copy.verb} ${cardCount(shownCount)}`}
        description={copy.description}
        confirmLabel={copy.verb}
        destructive={copy === BULK_COPY.hide}
        pending={bulkSet.isPending}
        onConfirm={(reason) => bulk.target && bulkSet.mutate({ ...bulk.target, reason })}
      />
    </Card>
  );
}
