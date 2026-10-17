"use client";
/**
 * Licence review: card art whose licence is unknown or restricted. Mark it open, or restricted, which hides the art.
 * Restricted art that still shows (recorded by a backfill, not yet hidden) can be hidden from here.
 */
import { useState } from "react";
import { Page } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  cardSourceLabel,
  commonsPageUrl,
  parseCardWikiSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { publicArticleUrl } from "~/lib/wiki-os/config";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useDialogTarget } from "~/app/admin/vault/player-cards/useDialogTarget";

type Status = "UNKNOWN" | "RESTRICTED";
type Row = RouterOutputs["cards"]["admin"]["compliance"]["licences"]["rows"][number];
type Marking = { cardId: string; title: string; status: "OPEN" | "RESTRICTED"; artHidden: boolean };

const STATUS_OPTIONS: ReadonlyArray<{ value: Status; label: string }> = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "RESTRICTED", label: "Restricted" },
];

/** The file's page on its wiki, where its licence is stated. */
function filePageUrl(wiki: CardWikiSource | null, fileTitle: string): string | null {
  if (!wiki) return null;
  return wiki === "commons" ? commonsPageUrl(fileTitle) : publicArticleUrl(fileTitle, wiki);
}

function FileCell({ row }: { row: Row }) {
  if (!row.fileTitle) return <>–</>;
  const href = row.descriptionUrl ?? filePageUrl(parseCardWikiSource(row.wiki), row.fileTitle);
  if (!href) return <>{row.fileTitle}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-tint">
      {row.fileTitle}
    </a>
  );
}

function dialogCopy(marking: Marking | null): string {
  if (marking?.status === "RESTRICTED") {
    return "This hides the art and files a takedown for the record.";
  }
  return marking?.artHidden
    ? "The art stays hidden. Restore it from Takedowns once the licence is open."
    : "The art keeps showing.";
}

export function LicenceReview() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [status, setStatus] = useState<Status>("UNKNOWN");
  const marking = useDialogTarget<Marking>();
  const [licence, setLicence] = useState("");
  const [note, setNote] = useState("");
  const list = api.cards.admin.compliance.licences.useQuery({ status });
  const save = api.cards.admin.compliance.setLicence.useMutation({
    onSuccess: () => {
      notify.success("Licence saved");
      marking.close();
      void utils.cards.admin.compliance.licences.invalidate();
      void utils.cards.admin.compliance.takedowns.invalidate();
      void utils.cards.admin.overview.summary.invalidate();
    },
    onError: (error) => notify.error("Licence not saved", error.message),
  });
  const mark = (row: Row, next: Marking["status"]) => {
    setLicence(row.licence ?? "");
    setNote(row.note ?? "");
    marking.open({
      cardId: row.cardId,
      title: row.card.title,
      status: next,
      artHidden: row.card.artwork === null,
    });
  };
  const shown = marking.shown;
  const rows = list.data?.rows ?? [];

  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<Page />}>Licence review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <SegmentedControl
          aria-label="Licence status"
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS}
        />
        {list.isError && (
          <p role="alert" className="text-destructive text-footnote">
            The licences did not load. Reload the page to try again.
          </p>
        )}
        {list.data?.rows.length === 0 && <EmptyState compact title="Nothing to review" />}
        {list.data && list.data.total > rows.length && (
          <p className="text-footnote text-label-secondary">
            The oldest {rows.length.toLocaleString()} of {list.data.total.toLocaleString()}.
          </p>
        )}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const wiki = parseCardWikiSource(row.wiki);
                return (
                  <TableRow key={row.cardId}>
                    <TableCell>
                      {row.card.title}
                      <p className="text-footnote text-label-secondary">
                        {wiki ? cardSourceLabel(wiki) : row.wiki}
                      </p>
                    </TableCell>
                    <TableCell>
                      <FileCell row={row} />
                    </TableCell>
                    <TableCell>{row.licence ?? "–"}</TableCell>
                    <TableCell className="space-x-1 text-right whitespace-nowrap">
                      <Button size="xs" variant="secondary" onClick={() => mark(row, "OPEN")}>
                        Mark open
                      </Button>
                      {status === "UNKNOWN" && (
                        <Button size="xs" variant="ghost" onClick={() => mark(row, "RESTRICTED")}>
                          Mark restricted
                        </Button>
                      )}
                      {status === "RESTRICTED" && row.card.artwork !== null && (
                        <Button size="xs" variant="ghost" onClick={() => mark(row, "RESTRICTED")}>
                          Hide art
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={marking.target !== null} onOpenChange={(open) => !open && marking.close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {shown?.status === "RESTRICTED"
                ? `Mark ${shown.title} restricted`
                : `Mark ${shown?.title ?? "this card"} open`}
            </DialogTitle>
            <DialogDescription>{dialogCopy(shown)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="licence-name">Licence</Label>
              <Input
                id="licence-name"
                maxLength={200}
                value={licence}
                onChange={(event) => setLicence(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="licence-note">Note</Label>
              <Input
                id="licence-note"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => marking.close()}>
              Cancel
            </Button>
            <Button
              variant={shown?.status === "RESTRICTED" ? "destructive" : "default"}
              disabled={licence.trim() === "" || save.isPending}
              onClick={() =>
                marking.target &&
                save.mutate({
                  cardId: marking.target.cardId,
                  status: marking.target.status,
                  licence: licence.trim(),
                  note: note.trim() || undefined,
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
