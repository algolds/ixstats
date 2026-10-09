"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { useNotify } from "~/hooks/useNotify";
import { timeAgo } from "~/lib/format/compact";
import { postHref, threadHref } from "~/lib/thinkpages-forum/links";
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import { BanDialog, banScopeOptions, categoryLabel } from "../BanDialog";
import { WarnDialog } from "../WarnDialog";
import {
  memberName,
  ModPanel,
  ModRow,
  useFilterChange,
  useModRefresh,
  type Members,
  type ModContext,
  type PanelProps,
} from "./ModRow";
import { NoteDialog } from "./NoteDialog";

type Reports = RouterOutputs["thinkpagesForumMod"]["reports"];
type Report = Reports["rows"][number];
type Status = "open" | "resolved" | "dismissed";
type Outcome = "resolved" | "dismissed";
type Open = "hide" | "warn" | "ban" | Outcome | null;

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
] as const;

const OUTCOME_COPY: Record<Outcome, { verb: string; done: string; description: string }> = {
  resolved: {
    verb: "Resolve",
    done: "Report resolved",
    description: "You acted on it. The member who reported it is not told.",
  },
  dismissed: {
    verb: "Dismiss",
    done: "Report dismissed",
    description: "Nothing needed doing. The member who reported it is not told.",
  },
};

/** The reported post's place in its thread, or the thread itself. */
function targetHref(report: Report): string | null {
  if (!report.threadId) return null;
  return report.targetType === "post" ? postHref(report.targetId) : threadHref(report.threadId);
}

/** Reports in the categories the viewer moderates: open by default, newest first. */
export function ReportQueue({ context, realm, page, basePath }: PanelProps) {
  const [status, setStatus] = useState<Status>("open");
  const query = api.thinkpagesForumMod.reports.useQuery({ status, realm, page });
  const refresh = useModRefresh();
  const filter = useFilterChange(basePath, page);
  const rows = query.data?.rows ?? [];
  return (
    <ModPanel
      content="feed"
      label="Reports"
      toolbar={
        <SegmentedControl
          aria-label="Report status"
          size="sm"
          options={STATUSES}
          value={status}
          onValueChange={(next) => filter(() => setStatus(next))}
        />
      }
      query={query}
      rowCount={rows.length}
      emptyTitle={status === "open" ? "No open reports" : "No reports here"}
      paging={{ total: query.data?.total, perPage: MOD_ROWS_PER_PAGE, page, basePath }}
    >
      {rows.map((report) => (
        <ReportRow
          key={report.id}
          report={report}
          members={query.data?.authors}
          context={context}
          refresh={refresh}
        />
      ))}
    </ModPanel>
  );
}

interface ReportRowProps {
  report: Report;
  members: Members | undefined;
  context: ModContext;
  refresh: () => Promise<void>;
}

function ReportRow({ report, members, context, refresh }: ReportRowProps) {
  const href = targetHref(report);
  const handled = report.status !== "open";
  return (
    <ModRow
      title={
        href && report.excerpt ? (
          <Link href={href} className="text-label hover:underline">
            {report.excerpt}
          </Link>
        ) : (
          <span className="text-label-secondary">The reported content is gone</span>
        )
      }
      meta={[
        report.category ? categoryLabel(report.category) : null,
        report.targetType === "post" ? "Post" : "Thread",
        report.reporterId ? `Reported by ${memberName(members, report.reporterId)}` : null,
        timeAgo(report.createdAt),
      ]}
      actions={
        <ReportActions
          report={report}
          href={href}
          authorName={report.targetAuthorId ? memberName(members, report.targetAuthorId) : null}
          context={context}
          refresh={refresh}
        />
      }
    >
      <p className="text-callout text-label break-words">{report.reason}</p>
      {report.ownTarget ? (
        <p className="text-footnote text-label-secondary">About your own content</p>
      ) : null}
      {handled ? (
        <p className="text-footnote text-label-secondary flex flex-wrap items-center gap-2">
          <Badge>{report.status === "resolved" ? "Resolved" : "Dismissed"}</Badge>
          {report.handledBy ? <span>{`by ${memberName(members, report.handledBy)}`}</span> : null}
          {report.note ? <span className="break-words">{report.note}</span> : null}
        </p>
      ) : null}
    </ModRow>
  );
}

interface ReportActionsProps {
  report: Report;
  href: string | null;
  /** The reported content's author, by name; null when it is gone. */
  authorName: string | null;
  context: ModContext;
  refresh: () => Promise<void>;
}

/**
 * Open, then for an open report on someone else's content that still exists: hide (unhide when it already is), warn,
 * ban, resolve, dismiss.
 */
function ReportActions({ report, href, authorName, context, refresh }: ReportActionsProps) {
  const notify = useNotify();
  const [open, setOpen] = useState<Open>(null);
  const { mutateAsync: resolve } = api.thinkpagesForumMod.resolveReport.useMutation();
  const { mutateAsync: hidePost } = api.thinkpagesForumMod.setPostHidden.useMutation();
  const { mutateAsync: setThreadFlag } = api.thinkpagesForumMod.setThreadFlag.useMutation();
  // Only what the server allows: nothing on a site admin's content for non-admins (`moderable`), and no Warn or
  // Ban on a site admin, a moderator of the place, or the viewer (`sanctionable`).
  const actionable = report.status === "open" && !report.ownTarget && report.moderable;
  const author = report.targetAuthorId;
  const kind = report.targetType === "post" ? "post" : "thread";
  // Names each row's buttons apart for screen readers: "Hide Rhea's post", "Resolve the report on Rhea's post".
  const content = authorName ? `${authorName}'s ${kind}` : `this ${kind}`;
  // A hidden target offers Unhide through the same confirmation (the server refuses hiding it twice).
  const hiding = !report.hidden;
  const verb = hiding ? "Hide" : "Unhide";
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };

  const setHidden = (note: string | undefined) => {
    const extra = note ? { note } : {};
    const done =
      kind === "post"
        ? hidePost({ postId: report.targetId, hidden: hiding, ...extra })
        : setThreadFlag({ threadId: report.targetId, flag: "hidden", value: hiding, ...extra });
    return done.then(() => {
      notify.success(`${kind === "post" ? "Post" : "Thread"} ${hiding ? "hidden" : "unhidden"}`);
      void refresh();
    });
  };

  const settle = (outcome: Outcome) => (note: string | undefined) =>
    resolve({ reportId: report.id, outcome, ...(note ? { note } : {}) }).then(() => {
      notify.success(OUTCOME_COPY[outcome].done);
      void refresh();
    });

  return (
    <>
      {href ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={href} aria-label={`Open ${content}`}>
            Open
          </Link>
        </Button>
      ) : null}
      {actionable && author ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${verb} ${content}`}
            onClick={() => setOpen("hide")}
          >
            {verb}
          </Button>
          {report.sanctionable ? (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Warn ${authorName ?? "the author"}`}
              onClick={() => setOpen("warn")}
            >
              Warn author
            </Button>
          ) : null}
          {report.sanctionable && report.category ? (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Ban ${authorName ?? "the author"}`}
              onClick={() => setOpen("ban")}
            >
              Ban author
            </Button>
          ) : null}
        </>
      ) : null}
      {actionable
        ? (["resolved", "dismissed"] as const).map((outcome) => (
            <Button
              key={outcome}
              size="sm"
              variant={outcome === "resolved" ? "default" : "ghost"}
              aria-label={`${OUTCOME_COPY[outcome].verb} the report on ${content}`}
              onClick={() => setOpen(outcome)}
            >
              {OUTCOME_COPY[outcome].verb}
            </Button>
          ))
        : null}

      {open === "hide" ? (
        <NoteDialog
          title={`${verb} this ${kind}`}
          description={
            hiding
              ? "Members no longer see it. Moderators still do, marked Hidden."
              : "Members see it again."
          }
          confirmLabel={`${verb} ${kind}`}
          destructive={hiding}
          onConfirm={setHidden}
          onOpenChange={close}
        />
      ) : null}
      {open === "resolved" || open === "dismissed" ? (
        <NoteDialog
          title={`${OUTCOME_COPY[open].verb} this report`}
          description={OUTCOME_COPY[open].description}
          confirmLabel={OUTCOME_COPY[open].verb}
          onConfirm={settle(open)}
          onOpenChange={close}
        />
      ) : null}
      {open === "warn" && author ? (
        <WarnDialog
          userId={author}
          target={{ type: kind, id: report.targetId }}
          open
          onOpenChange={close}
          onDone={() => void refresh()}
        />
      ) : null}
      {open === "ban" && author && report.category ? (
        <BanDialog
          userId={author}
          scopes={banScopeOptions(report.category, context)}
          open
          onOpenChange={close}
          onDone={() => void refresh()}
        />
      ) : null}
    </>
  );
}
