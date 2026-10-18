"use client";
/**
 * Reported inscriptions, oldest first: clear one (its copy can't be signed again) or dismiss the report. Players type
 * the inscription and the reason, so everything here renders as plain text.
 */
import { useRef } from "react";
import { ChatBubbleWarning } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useRowFocusRescue } from "~/hooks/admin/useRowFocusRescue";
import { useNotify } from "~/hooks/useNotify";
import { INSCRIPTION_QUEUE_SIZE } from "~/lib/cards/inscription";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type Report = RouterOutputs["cards"]["admin"]["compliance"]["inscriptionReports"][number];
type Resolve = (report: Report, action: "clear" | "dismiss") => void;

/** A player the queue has no name for (gone, or never named) reads "a player". */
const named = (name: string | null) => name ?? "a player";
const day = (date: Date) => new Date(date).toLocaleDateString();
/** The reported copy, by card and serial ("Aurelia #12"). */
const copyName = (report: Report) => `${report.cardTitle} #${report.serialNumber}`;

/** Clearing can't be undone, so it asks first; the dialog's trigger gets focus back when it closes. */
function ClearInscription({
  report,
  busy,
  onResolve,
}: {
  report: Report;
  busy: boolean;
  onResolve: Resolve;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="xs"
          variant="destructive"
          disabled={busy}
          aria-label={`Clear inscription on ${copyName(report)}`}
          data-row-action=""
        >
          Clear inscription
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear this inscription?</AlertDialogTitle>
          <AlertDialogDescription>
            {`The text and the signer's name come off ${copyName(report)}, and it can't be signed again. Every open report on it closes.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onResolve(report, "clear")}>
            Clear inscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReportRow({
  report,
  busy,
  onResolve,
}: {
  report: Report;
  busy: boolean;
  onResolve: Resolve;
}) {
  return (
    <TableRow>
      <TableCell className="max-w-64 whitespace-normal">
        <p className="break-words">{`“${report.text}”`}</p>
        <p className="text-footnote text-label-secondary">
          {`${copyName(report)} · signed by ${named(report.signerName)}`}
        </p>
      </TableCell>
      <TableCell className="max-w-64 whitespace-normal">
        <p className="break-words">{report.reason}</p>
        <p className="text-footnote text-label-secondary">
          {`Reported by ${named(report.reporterName)} · ${day(report.createdAt)}`}
        </p>
      </TableCell>
      <TableCell pinned className="space-x-1 text-right whitespace-nowrap">
        <ClearInscription report={report} busy={busy} onResolve={onResolve} />
        <Button
          size="xs"
          variant="ghost"
          disabled={busy}
          aria-label={`Dismiss report on ${copyName(report)}`}
          onClick={() => onResolve(report, "dismiss")}
        >
          Dismiss
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function InscriptionReports() {
  const notify = useNotify();
  const utils = api.useUtils();
  const reports = api.cards.admin.compliance.inscriptionReports.useQuery();
  const rows = reports.data ?? [];
  const list = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const acted = useRowFocusRescue(
    rows.map((report) => report.id),
    list,
    heading
  );
  const refresh = () => void utils.cards.admin.compliance.inscriptionReports.invalidate();
  const resolve = api.cards.admin.compliance.resolveInscriptionReport.useMutation({
    onSuccess: ({ status }) => {
      notify.success(status === "cleared" ? "Inscription cleared" : "Report dismissed");
      refresh();
    },
    // A report another admin handled first says so, and leaves the queue once it refreshes
    onError: (error) => {
      notify.error("Report not changed", error.message);
      refresh();
    },
  });
  const onResolve: Resolve = (report, action) => {
    acted(report.id);
    resolve.mutate({ reportId: report.id, action });
  };

  return (
    <Card content="data">
      <CardHeader className="pt-5">
        {/* Where focus goes when the last report it was on leaves */}
        <CardTitle ref={heading} tabIndex={-1} icon={<ChatBubbleWarning />}>
          Reported inscriptions
        </CardTitle>
      </CardHeader>
      <CardContent ref={list} className="space-y-4 pb-5" aria-busy={reports.isLoading}>
        {reports.isLoading && (
          <div role="status">
            <span className="sr-only">Loading reports</span>
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {reports.isError && (
          <p role="alert" className="text-destructive text-footnote">
            The reports did not load. Reload the page to try again.
          </p>
        )}
        {reports.data?.length === 0 && (
          <EmptyState
            compact
            title="No open reports"
            message="Inscriptions players report appear here, oldest first."
          />
        )}
        {rows.length >= INSCRIPTION_QUEUE_SIZE && (
          <p className="text-footnote text-label-secondary">
            {`The queue shows the oldest ${INSCRIPTION_QUEUE_SIZE} open reports at a time.`}
          </p>
        )}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inscription</TableHead>
                <TableHead>Report</TableHead>
                <TableHead pinned>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  busy={resolve.isPending}
                  onResolve={onResolve}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
