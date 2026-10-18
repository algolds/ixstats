"use client";
/** Takedown requests from every source, oldest deadline first: hide the art, decline, or restore hidden art. */
import { useState } from "react";
import { Plus, ShieldCheck } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cardSourceLabel, parseCardWikiSource } from "~/lib/cards/card-sources";
import { Badge } from "~/components/ui/badge";
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
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";
import { CARD_TYPE_LABELS, labelOf } from "../shared/card-labels";
import { ReasonDialog } from "../shared/ReasonDialog";
import { FileTakedownDialog } from "./FileTakedownDialog";

type View = "OPEN" | "HIDDEN" | "ANSWERED";
type Takedown = RouterOutputs["cards"]["admin"]["compliance"]["takedowns"][number];

const VIEW_OPTIONS: ReadonlyArray<{ value: View; label: string }> = [
  { value: "OPEN", label: "Waiting" },
  { value: "HIDDEN", label: "Art hidden" },
  { value: "ANSWERED", label: "Declined or restored" },
];

const ORIGIN_LABELS: Readonly<Record<Takedown["origin"], string>> = {
  NS_SELF_SERVICE: "NationStates flag owner",
  AUTHOR_REQUEST: "Author",
  LICENCE_REVIEW: "Licence review",
  ADMIN: "Admin",
  PLAYER_REQUEST: "Player",
};

/** Where a card comes from: its wiki (a Lore card with none is IxWiki's), else its type (NationStates, Special). */
function cardSource(card: Takedown["card"]): string {
  const wiki = parseCardWikiSource(card.wikiSource) ?? (card.cardType === "LORE" ? "ixwiki" : null);
  return wiki ? cardSourceLabel(wiki) : labelOf(CARD_TYPE_LABELS, card.cardType);
}

const day = (date: Date | null) => (date ? new Date(date).toLocaleDateString() : "–");

interface RowActions {
  busy: boolean;
  onHide: (takedown: Takedown) => void;
  onDecline: (takedown: Takedown) => void;
  onRestore: (takedown: Takedown) => void;
}

function TakedownRow({
  takedown,
  now,
  actions,
}: {
  takedown: Takedown;
  now: number;
  actions: RowActions;
}) {
  const waiting = takedown.status === "OPEN";
  return (
    <TableRow>
      <TableCell>
        {takedown.card.title}
        <p className="text-footnote text-label-secondary">{cardSource(takedown.card)}</p>
      </TableCell>
      <TableCell>
        {labelOf(ORIGIN_LABELS, takedown.origin)}
        {takedown.contact && (
          <p className="text-footnote text-label-secondary">{takedown.contact}</p>
        )}
      </TableCell>
      <TableCell className="max-w-64">
        {takedown.reason}
        {takedown.resolutionNote && (
          <p className="text-footnote text-label-secondary">{takedown.resolutionNote}</p>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {day(waiting ? takedown.dueAt : takedown.resolvedAt)}
        {waiting && new Date(takedown.dueAt).getTime() < now && (
          <Badge variant="destructive" className="ml-2">
            Overdue
          </Badge>
        )}
      </TableCell>
      <TableCell pinned className="space-x-1 text-right whitespace-nowrap">
        {waiting && (
          <>
            <Button size="xs" disabled={actions.busy} onClick={() => actions.onHide(takedown)}>
              Hide art
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={actions.busy}
              onClick={() => actions.onDecline(takedown)}
            >
              Decline
            </Button>
          </>
        )}
        {takedown.status === "HIDDEN" && (
          <Button
            size="xs"
            variant="secondary"
            disabled={actions.busy}
            onClick={() => actions.onRestore(takedown)}
          >
            Restore art
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function TakedownQueue() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [view, setView] = useState<View>("OPEN");
  const [filing, setFiling] = useState(false);
  const declining = useDialogTarget<Takedown>();
  const list = api.cards.admin.compliance.takedowns.useQuery({ status: view });
  const done = (title: string) => () => {
    notify.success(title);
    void utils.cards.admin.compliance.takedowns.invalidate();
    void utils.cards.admin.overview.summary.invalidate();
  };
  const onError = (error: { message: string }) =>
    notify.error("Takedown not changed", error.message);
  const hide = api.cards.admin.compliance.hide.useMutation({
    onSuccess: done("Art hidden"),
    onError,
  });
  const restore = api.cards.admin.compliance.restore.useMutation({
    onSuccess: done("Art restored"),
    onError,
  });
  const decline = api.cards.admin.compliance.decline.useMutation({
    onSuccess: () => {
      declining.close();
      done("Takedown declined")();
    },
    onError,
  });
  const actions: RowActions = {
    busy: hide.isPending || restore.isPending,
    onHide: (takedown) => hide.mutate({ takedownId: takedown.id }),
    onDecline: declining.open,
    onRestore: (takedown) => restore.mutate({ takedownId: takedown.id }),
  };
  const now = Date.now();

  return (
    <Card content="data">
      <CardHeader className="flex flex-row items-center justify-between pt-5">
        <CardTitle icon={<ShieldCheck />}>Takedowns</CardTitle>
        <Button size="sm" onClick={() => setFiling(true)}>
          <Plus />
          File a takedown
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <SegmentedControl
          aria-label="Takedown status"
          value={view}
          onValueChange={setView}
          options={VIEW_OPTIONS}
        />
        {list.isError && (
          <p role="alert" className="text-destructive text-footnote">
            The takedowns did not load. Reload the page to try again.
          </p>
        )}
        {list.data?.length === 0 && <EmptyState compact title="No takedowns here" />}
        {list.data && list.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>{view === "OPEN" ? "Due" : "Answered"}</TableHead>
                <TableHead pinned>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((takedown) => (
                <TakedownRow key={takedown.id} takedown={takedown} now={now} actions={actions} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <FileTakedownDialog open={filing} onOpenChange={setFiling} />
      <ReasonDialog
        open={declining.target !== null}
        onOpenChange={(open) => !open && declining.close()}
        title={`Decline the takedown of ${declining.shown?.card.title ?? "this card"}`}
        description="Say why the art can stay, for example the licence we hold. The reason is kept with the request."
        confirmLabel="Decline"
        pending={decline.isPending}
        onConfirm={(note) =>
          declining.target && decline.mutate({ takedownId: declining.target.id, note })
        }
      />
    </Card>
  );
}
