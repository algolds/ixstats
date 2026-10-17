"use client";
/** Players' free article suggestions: make one into a card (it goes straight into packs) or decline it. */
import { useState } from "react";
import { LightBulb } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cardSourceLabel, parseCardWikiSource } from "~/lib/cards/card-sources";
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
import { ReasonDialog } from "../shared/ReasonDialog";

type Status = "PENDING" | "DONE";

const STATUS_OPTIONS: ReadonlyArray<{ value: Status; label: string }> = [
  { value: "PENDING", label: "Waiting" },
  { value: "DONE", label: "Answered" },
];

const sourceLabel = (value: string) => {
  const source = parseCardWikiSource(value);
  return source ? cardSourceLabel(source) : value;
};

export function SuggestionsList() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [status, setStatus] = useState<Status>("PENDING");
  const [declining, setDeclining] = useState<string | null>(null);
  const list = api.cards.admin.curation.suggestions.useQuery({ status });
  const refresh = () => void utils.cards.admin.curation.suggestions.invalidate();
  const accept = api.cards.admin.curation.acceptSuggestion.useMutation({
    onSuccess: () => {
      notify.success("Card made", "It is in packs now.");
      refresh();
    },
    onError: (error) => notify.error("Card not made", error.message),
  });
  const decline = api.cards.admin.curation.declineSuggestion.useMutation({
    onSuccess: () => {
      setDeclining(null);
      refresh();
    },
    onError: (error) => notify.error("Suggestion not declined", error.message),
  });
  const rows = list.data ?? [];
  /** The row whose card is being made: it cannot be declined meanwhile. */
  const making = accept.isPending ? accept.variables?.requestId : undefined;

  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<LightBulb />}>Suggestions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <SegmentedControl
          aria-label="Suggestion status"
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS}
        />
        {list.isError ? (
          <p role="alert" className="text-destructive text-footnote">
            Suggestions did not load. {list.error.message}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            title={status === "PENDING" ? "No suggestions waiting" : "No answered suggestions"}
            message={status === "PENDING" ? "Players' article suggestions appear here." : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Realm</TableHead>
                <TableHead>Suggested</TableHead>
                <TableHead pinned>
                  <span className="sr-only">Answer</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    {request.articleTitle}
                    <p className="text-footnote text-label-secondary">
                      {sourceLabel(request.wikiSource)}
                    </p>
                  </TableCell>
                  <TableCell>{request.realmName ?? "–"}</TableCell>
                  <TableCell className="tabular-nums">
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell pinned className="space-x-1 text-right whitespace-nowrap">
                    {request.status === "PENDING" ? (
                      <>
                        <Button
                          size="xs"
                          disabled={accept.isPending}
                          onClick={() => accept.mutate({ requestId: request.id })}
                        >
                          Make a card
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={making === request.id}
                          onClick={() => setDeclining(request.id)}
                        >
                          Decline
                        </Button>
                      </>
                    ) : (
                      <span className="text-footnote text-label-secondary">
                        {request.status === "GENERATED"
                          ? "Made a card"
                          : `Declined: ${request.rejectionReason ?? "–"}`}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ReasonDialog
        open={declining !== null}
        onOpenChange={(open) => !open && setDeclining(null)}
        title="Decline this suggestion"
        description="The player sees your reason."
        confirmLabel="Decline"
        pending={decline.isPending}
        onConfirm={(reason) => declining && decline.mutate({ requestId: declining, reason })}
      />
    </Card>
  );
}
