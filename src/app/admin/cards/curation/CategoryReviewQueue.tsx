"use client";
/**
 * Category review: the classifier's low-confidence guesses (approve, change or reject to Uncategorised) and players'
 * category suggestions (accept, change or reject). Every answer is the admin's one category write.
 */
import { useState } from "react";
import { Label as CategoryIcon } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";
import { cardSourceLabel, parseCardWikiSource } from "~/lib/cards/card-sources";
import { categoryLine, type CategoryChoice } from "~/lib/cards/category-taxonomy";
import { CategoryChoiceDialog } from "~/components/cards/category/CategoryChoiceDialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type Queue = RouterOutputs["cards"]["admin"]["categories"];
type Classification = Queue["classifications"]["rows"][number];
type Suggestion = Queue["suggestions"]["rows"][number];
type Kind = "classifications" | "suggestions";

const PAGE = 50;
/** The router's longest page: past it, answering rows brings the next ones in. */
const MOST_SHOWN = 1000;

const UNCATEGORISED: CategoryChoice = { category: null, subcategory: null };

/** What the Change dialog is changing: a card's guess, or a player's suggestion. */
type ChangeTarget =
  { kind: "classification"; row: Classification } | { kind: "suggestion"; row: Suggestion };

const choiceOf = (row: CategoryChoice): CategoryChoice => ({
  category: row.category,
  subcategory: row.subcategory,
});

const percent = (confidence: number | null) =>
  confidence === null ? "–" : `${Math.round(confidence * 100)}%`;

const sourceLine = (row: Classification) => {
  const source = parseCardWikiSource(row.wikiSource);
  return [source ? cardSourceLabel(source) : row.wikiSource, row.realm.name]
    .filter(Boolean)
    .join(" · ");
};

interface RowActions {
  busy: boolean;
  labels: readonly [string, string, string];
  onApprove: () => void;
  onChange: () => void;
  onReject: () => void;
  /** Names the row's buttons: "Approve the category of Kiro". */
  name: (label: string) => string;
}

function Actions({ busy, labels, onApprove, onChange, onReject, name }: RowActions) {
  const [approve, change, reject] = labels;
  return (
    <TableCell pinned className="space-x-1 text-right whitespace-nowrap">
      <Button size="xs" disabled={busy} aria-label={name(approve)} onClick={onApprove}>
        {approve}
      </Button>
      <Button
        size="xs"
        variant="secondary"
        disabled={busy}
        aria-label={name(change)}
        onClick={onChange}
      >
        {change}
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={busy}
        aria-label={name(reject)}
        onClick={onReject}
      >
        {reject}
      </Button>
    </TableCell>
  );
}

interface TableProps<Row> {
  rows: Row[];
  busy: boolean;
  onSet: (cardId: string, choice: CategoryChoice) => void;
  onChange: (target: ChangeTarget) => void;
}

function ClassificationTable({ rows, busy, onSet, onChange }: TableProps<Classification>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead pinned>
            <span className="sr-only">Answer</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              {row.title}
              <p className="text-footnote text-label-secondary">{sourceLine(row)}</p>
            </TableCell>
            <TableCell>{categoryLine(row.category, row.subcategory)}</TableCell>
            <TableCell className="tabular-nums">{percent(row.categoryConfidence)}</TableCell>
            <Actions
              busy={busy}
              labels={["Approve", "Change", "Reject"]}
              name={(label) => `${label} the category of ${row.title}`}
              onApprove={() => onSet(row.id, choiceOf(row))}
              onChange={() => onChange({ kind: "classification", row })}
              onReject={() => onSet(row.id, UNCATEGORISED)}
            />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface SuggestionTableProps extends Omit<TableProps<Suggestion>, "onSet"> {
  onAnswer: (suggestionId: string, decision: "ACCEPT" | "REJECT") => void;
}

function SuggestionTable({ rows, busy, onAnswer, onChange }: SuggestionTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead>Now</TableHead>
          <TableHead>Suggested</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Player</TableHead>
          <TableHead pinned>
            <span className="sr-only">Answer</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              {row.card.title}
              <p className="text-footnote text-label-secondary">{row.card.realm.name}</p>
            </TableCell>
            <TableCell>{categoryLine(row.card.category, row.card.subcategory)}</TableCell>
            <TableCell>{categoryLine(row.category, row.subcategory)}</TableCell>
            <TableCell className="max-w-xs break-words">{row.note ?? "–"}</TableCell>
            <TableCell>{row.player ?? "–"}</TableCell>
            <Actions
              busy={busy}
              labels={["Accept", "Change", "Reject"]}
              name={(label) => `${label} the suggestion for ${row.card.title}`}
              onApprove={() => onAnswer(row.id, "ACCEPT")}
              onChange={() => onChange({ kind: "suggestion", row })}
              onReject={() => onAnswer(row.id, "REJECT")}
            />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const EMPTY: Record<Kind, string> = {
  classifications: "No low-confidence categories",
  suggestions: "No category suggestions waiting",
};

const withTotal = (label: string, total: number | undefined) =>
  total === undefined ? label : `${label} · ${total.toLocaleString()}`;

export function CategoryReviewQueue() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [kind, setKind] = useState<Kind>("classifications");
  const [shown, setShown] = useState<Record<Kind, number>>({
    classifications: PAGE,
    suggestions: PAGE,
  });
  const change = useDialogTarget<ChangeTarget>();
  const queues = {
    classifications: api.cards.admin.categories.classifications.useQuery({
      limit: shown.classifications,
    }),
    suggestions: api.cards.admin.categories.suggestions.useQuery({ limit: shown.suggestions }),
  };
  const saved = {
    onSuccess: () => {
      change.close();
      void utils.cards.admin.categories.invalidate();
    },
    onError: (error: { message: string }) => notify.error("Category not saved", error.message),
  };
  const set = api.cards.admin.categories.set.useMutation(saved);
  const answer = api.cards.admin.categories.answerSuggestion.useMutation(saved);
  const busy = set.isPending || answer.isPending;

  const query = queues[kind];
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const confirmChange = (choice: CategoryChoice) => {
    const target = change.target;
    if (target?.kind === "classification") set.mutate({ cardId: target.row.id, choice });
    if (target?.kind === "suggestion") {
      answer.mutate({ suggestionId: target.row.id, decision: "CHANGE", choice });
    }
  };

  const table =
    kind === "classifications" ? (
      <ClassificationTable
        rows={queues.classifications.data?.rows ?? []}
        busy={busy}
        onSet={(cardId, choice) => set.mutate({ cardId, choice })}
        onChange={change.open}
      />
    ) : (
      <SuggestionTable
        rows={queues.suggestions.data?.rows ?? []}
        busy={busy}
        onAnswer={(suggestionId, decision) => answer.mutate({ suggestionId, decision })}
        onChange={change.open}
      />
    );

  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<CategoryIcon />}>Category review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-5" aria-busy={query.isLoading}>
        <SegmentedControl
          asTabs
          aria-label="Category review"
          value={kind}
          onValueChange={setKind}
          options={[
            {
              value: "classifications",
              label: withTotal("Low confidence", queues.classifications.data?.total),
            },
            {
              value: "suggestions",
              label: withTotal("Player suggestions", queues.suggestions.data?.total),
            },
          ]}
        />
        {query.isError ? (
          <p role="alert" className="text-destructive text-footnote">
            The queue did not load. {query.error.message}
          </p>
        ) : query.isLoading ? null : rows.length === 0 ? (
          <EmptyState compact title={EMPTY[kind]} />
        ) : (
          table
        )}
        {rows.length < total && shown[kind] < MOST_SHOWN && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShown((prev) => ({ ...prev, [kind]: prev[kind] + PAGE }))}
          >
            Show more
          </Button>
        )}
      </CardContent>
      <CategoryChoiceDialog
        open={change.target !== null}
        onOpenChange={(open) => !open && change.close()}
        title="Change the category"
        initial={change.shown ? choiceOf(change.shown.row) : UNCATEGORISED}
        confirmLabel="Save"
        pending={busy}
        onConfirm={confirmChange}
      />
    </Card>
  );
}
