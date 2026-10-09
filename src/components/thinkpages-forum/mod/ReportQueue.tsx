"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { timeAgo } from "~/lib/format/compact";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import { BanDialog, banScopeOptions } from "../BanDialog";
import { WarnDialog } from "../WarnDialog";
import {
  categoryLabel,
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
  const thread = threadHref(report.threadId);
  return report.targetType === "post" ? `${thread}#post-${report.targetId}` : thread;
}

/** Reports in the categories the viewer moderates: open by default, newest first. */
export function ReportQueue({ context, realm, page, basePath }: PanelProps) {
  const [status, setStatus] = useState<Status>("open");
  const query = api.thinkpagesForumMod.reports.useQuery({ status, realm, page });
  const refresh = useModRefresh("reports");
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
      actions={<ReportActions report={report} href={href} context={context} refresh={refresh} />}
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
  context: ModContext;
  refresh: () => Promise<void>;
}

/** Open, then for an open report on someone else's content that still exists: hide, warn, ban, resolve, dismiss. */
function ReportActions({ report, href, context, refresh }: ReportActionsProps) {
  const [open, setOpen] = useState<Open>(null);
  const { mutateAsync: resolve } = api.thinkpagesForumMod.resolveReport.useMutation();
  const { mutateAsync: hidePost } = api.thinkpagesForumMod.setPostHidden.useMutation();
  const { mutateAsync: setThreadFlag } = api.thinkpagesForumMod.setThreadFlag.useMutation();
  const actionable = report.status === "open" && !report.ownTarget;
  const author = report.targetAuthorId;
  const kind = report.targetType === "post" ? "post" : "thread";
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };

  const hide = (note: string | undefined) => {
    const extra = note ? { note } : {};
    const done =
      kind === "post"
        ? hidePost({ postId: report.targetId, hidden: true, ...extra })
        : setThreadFlag({ threadId: report.targetId, flag: "hidden", value: true, ...extra });
    return done.then(refresh);
  };

  const settle = (outcome: Outcome) => (note: string | undefined) =>
    resolve({ reportId: report.id, outcome, ...(note ? { note } : {}) }).then(refresh);

  return (
    <>
      {href ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={href}>Open</Link>
        </Button>
      ) : null}
      {actionable && author ? (
        <>
          <Button size="sm" variant="secondary" onClick={() => setOpen("hide")}>
            Hide
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpen("warn")}>
            Warn author
          </Button>
          {report.category ? (
            <Button size="sm" variant="secondary" onClick={() => setOpen("ban")}>
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
              onClick={() => setOpen(outcome)}
            >
              {OUTCOME_COPY[outcome].verb}
            </Button>
          ))
        : null}

      {open === "hide" ? (
        <NoteDialog
          title={`Hide this ${kind}`}
          description="Members no longer see it. Moderators still do, marked Hidden."
          confirmLabel={`Hide ${kind}`}
          destructive
          onConfirm={hide}
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
