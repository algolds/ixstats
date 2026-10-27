"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { useNotify } from "~/hooks/useNotify";
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";
import { categoryLine, type CategoryChoice } from "~/lib/cards/category-taxonomy";
import { CategoryChoiceDialog } from "~/components/cards/category/CategoryChoiceDialog";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ManageSection } from "../ManageSection";

type Show = "all" | "uncategorised" | "review";
type Row = RouterOutputs["cards"]["realmCategories"]["list"]["rows"][number];

const PAGE = 50;
/** The router's longest page: past it, a search finds the rest. */
const MOST_SHOWN = 1000;

const UNCATEGORISED: CategoryChoice = { category: null, subcategory: null };

const SHOWS: ReadonlyArray<{ value: Show; label: string }> = [
  { value: "all", label: "All" },
  { value: "uncategorised", label: "Uncategorised" },
  { value: "review", label: "Needs review" },
];

function CategoryTable({ rows, onEdit }: { rows: Row[]; onEdit: (row: Row) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead>Category</TableHead>
          <TableHead pinned>
            <span className="sr-only">Edit</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.title}</TableCell>
            <TableCell>{categoryLine(row.category, row.subcategory)}</TableCell>
            <TableCell pinned className="text-right">
              <Button
                size="xs"
                variant="secondary"
                aria-label={`Edit the category of ${row.title}`}
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

/** Manage → Cards: the founder (and site admins) set the category of each lore card from the realm. */
export function CardCategoriesSection({ slug }: { slug: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [limit, setLimit] = useState(PAGE);
  const query = useDebounce(search.trim());
  const edit = useDialogTarget<Row>();
  const list = api.cards.realmCategories.list.useQuery(
    { slug, search: query || undefined, show, limit },
    { placeholderData: (previous) => previous }
  );
  const set = api.cards.realmCategories.set.useMutation({
    onSuccess: () => {
      edit.close();
      void utils.cards.realmCategories.list.invalidate();
    },
    onError: (error) => notify.error("Category not saved", error.message),
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const filtered = query !== "" || show !== "all";
  // A new search or view starts from the first page again
  const filter =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      apply(value);
      setLimit(PAGE);
    };

  return (
    <ManageSection
      id="card-categories"
      title="Card categories"
      description="The category of each lore card from this realm. Players see it on the card and filter by it."
    >
      <div className="flex flex-col gap-4" aria-busy={list.isLoading}>
        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            size="sm"
            value={search}
            onValueChange={filter(setSearch)}
            placeholder="Search by title"
            aria-label="Search by title"
            containerClassName="min-w-48 flex-1"
          />
          <SegmentedControl
            aria-label="Cards shown"
            size="sm"
            value={show}
            onValueChange={filter(setShow)}
            options={SHOWS}
          />
        </div>
        {list.isError ? (
          <p role="alert" className="text-destructive text-footnote">
            The cards did not load. {list.error.message}
          </p>
        ) : list.isLoading ? null : rows.length === 0 ? (
          <EmptyState
            compact
            title={filtered ? "No cards match" : "No lore cards from this realm yet"}
          />
        ) : (
          <CategoryTable rows={rows} onEdit={edit.open} />
        )}
        {rows.length < total && limit < MOST_SHOWN && (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setLimit((prev) => prev + PAGE)}
          >
            Show more
          </Button>
        )}
      </div>
      <CategoryChoiceDialog
        open={edit.target !== null}
        onOpenChange={(open) => !open && edit.close()}
        title={`Category of ${edit.shown?.title ?? "the card"}`}
        initial={
          edit.shown
            ? { category: edit.shown.category, subcategory: edit.shown.subcategory }
            : UNCATEGORISED
        }
        confirmLabel="Save"
        pending={set.isPending}
        onConfirm={(choice) => edit.target && set.mutate({ slug, cardId: edit.target.id, choice })}
      />
    </ManageSection>
  );
}
