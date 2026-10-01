"use client";

import React, { useId, useMemo, useState } from "react";
import {
  KeyCommand as Command,
  Archive,
  Calendar,
  Clock,
  DoubleCheck,
  Mail,
  MailOpen,
  TriangleFlag,
} from "iconoir-react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import type { FacetRowSwipeActions } from "~/components/ui/facet-list";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useIxTimeStore } from "~/stores/ixtime-store";
import {
  type AgendaItem,
  type AgendaMailbox,
  type AgendaSourceElection,
  type AgendaSourceIntent,
  type AgendaSourceIssue,
  type ExecutiveAgendaProps,
  type InboxView,
  AGENDA_MAILBOX_LABEL,
  AgendaEventActionDialog,
  SNOOZE_DAY_MS,
  deriveAgendaItems,
  formatInboxTime,
  inMailbox,
  useAgendaInbox,
} from "./agenda";
import { STATUS_TEXT } from "./status-tone";
import { HUE_BADGE, hueAccentStyle } from "./domain-hue";

const MAILBOXES: AgendaMailbox[] = ["all", "action", "issues", "directives", "elections"];

/**
 * The executive agenda as an inbox: open national issues, active directives and upcoming
 * elections, newest and most pressing first. Rows show the source, title, a one-line preview and
 * a relative time ("2h ago") or deadline pressure ("Due soon", "Overdue") — never calendar
 * dates. Items can be marked read or unread, snoozed for a day or a week, or marked done; that
 * state lives in this browser per country (`ixstats:agenda-inbox:<countryId>`), and an item
 * comes back when its underlying state changes. Nothing is invented: an empty inbox says so.
 */
function ExecutiveAgendaComponent({
  countryId,
  onOpenDrill,
  onIssueDirective,
  onOpenIntent,
}: ExecutiveAgendaProps): React.JSX.Element {
  const [mailbox, setMailbox] = useState<AgendaMailbox>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const archivedId = useId();

  // IxTime "now", quantised so derivation does not re-run every tick.
  const nowIxTime = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 60_000) * 60_000);

  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const elections = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  // Weekly directive slots for the v2 header pill.
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  const isLoading = intentTree.isLoading || issuesData.isLoading;
  // Stored flags are only pruned against a complete, successful load.
  const ready = intentTree.isSuccess && issuesData.isSuccess && elections.isSuccess;

  const items = useMemo<AgendaItem[]>(() => {
    const rawIntents = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    return deriveAgendaItems({
      issues: (issuesData.data?.issues ?? []) as AgendaSourceIssue[],
      intents: rawIntents as AgendaSourceIntent[],
      elections: (elections.data ?? []) as AgendaSourceElection[],
      nowIxTime,
    });
  }, [intentTree.data, issuesData.data, elections.data, nowIxTime]);

  const inbox = useAgendaInbox(countryId, items, ready);
  const inboxViews = useMemo(
    () => inbox.views.filter((v) => v.placement === "inbox"),
    [inbox.views]
  );
  const archivedViews = useMemo(
    () => inbox.views.filter((v) => v.placement !== "inbox"),
    [inbox.views]
  );
  const unread = inboxViews.filter((v) => !v.read);

  // Mailboxes with items (All always); the control shows only when there is a choice.
  const mailboxOptions = useMemo(
    () =>
      MAILBOXES.map((id) => ({
        id,
        count: inboxViews.filter((v) => inMailbox(v.item, id)).length,
      })).filter((m) => m.id === "all" || m.count > 0),
    [inboxViews]
  );
  const activeMailbox = mailboxOptions.some((m) => m.id === mailbox) ? mailbox : "all";
  const visible = inboxViews.filter((v) => inMailbox(v.item, activeMailbox));

  const openView = inbox.views.find((v) => v.item.id === openId) ?? null;

  const open = (view: InboxView) => {
    if (!view.read) inbox.setRead([view.item], true);
    setOpenId(view.item.id);
  };

  // Swipe on touch or trackpad; Shift+F10 / the ContextMenu key on a focused row opens the same
  // actions as a menu (SwipeableRow), and every action is also in the opened item.
  const swipeFor = (view: InboxView): FacetRowSwipeActions => ({
    leading: [
      {
        id: "read",
        icon: view.read ? Mail : MailOpen,
        label: view.read ? "Unread" : "Read",
        "aria-label": view.read ? "Mark as unread" : "Mark as read",
        color: "blue",
        onClick: () => inbox.setRead([view.item], !view.read),
      },
    ],
    trailing: [
      {
        id: "snooze",
        icon: Clock,
        label: "Snooze",
        "aria-label": "Snooze for a day",
        color: "amber",
        onClick: () => inbox.snooze(view.item, SNOOZE_DAY_MS),
      },
      {
        id: "done",
        icon: Archive,
        label: "Done",
        color: "green",
        onClick: () => inbox.markDone(view.item),
      },
    ],
    trailingCommit: {
      label: "Done",
      icon: Archive,
      action: () => inbox.markDone(view.item),
    },
  });

  return (
    <>
      <FacetCard
        id="executive-agenda"
        role="region"
        aria-labelledby="executive-agenda-title"
        className="rounded-card"
      >
        <FacetCardHeader className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-2 p-4 pb-0 sm:p-5 sm:pb-0">
          {/* v2 header (c5c6b382): the calendar badge in the agenda's cyan */}
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              style={hueAccentStyle("cyan")}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                HUE_BADGE
              )}
            >
              <Calendar className="size-4" />
            </span>
            <div className="min-w-0">
              <h2
                id="executive-agenda-title"
                className="text-label text-title-3 flex items-center gap-2"
              >
                Agenda
                {unread.length > 0 ? (
                  <Badge
                    variant="tinted"
                    className="font-data tabular-nums"
                    data-testid="agenda-unread-count"
                  >
                    {unread.length}
                    <span className="sr-only"> unread</span>
                  </Badge>
                ) : null}
              </h2>
              <p className="text-label-secondary text-footnote">
                Issues, directives and elections waiting on you
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status.data ? (
              /* v2 directives capacity pill: gold, mono figures */
              <span className="border-tint/30 bg-tint/10 text-footnote inline-flex items-center gap-2 rounded-full border px-3 py-1">
                <Command aria-hidden="true" className="text-tint size-3.5" />
                <span className="text-label-secondary">Directives</span>
                <span className="text-label font-data font-semibold tabular-nums">
                  {status.data.usedThisWeek}/{status.data.cap}
                </span>
                <span className="sr-only"> used this week</span>
              </span>
            ) : null}
            {unread.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  inbox.setRead(
                    unread.map((v) => v.item),
                    true
                  )
                }
              >
                <DoubleCheck aria-hidden="true" />
                Mark all as read
              </Button>
            ) : null}
          </div>
        </FacetCardHeader>

        <FacetCardContent className="flex flex-col gap-3 p-4 sm:p-5">
          {mailboxOptions.length > 1 ? (
            <div className="-mx-1 max-w-full scrollbar-none overflow-x-auto px-1">
              <SegmentedControl
                size="sm"
                aria-label="Mailbox"
                value={activeMailbox}
                onValueChange={(v) => setMailbox(v)}
                options={mailboxOptions.map(({ id, count }) => ({
                  value: id,
                  "aria-label": `${AGENDA_MAILBOX_LABEL[id]}, ${count} item${count === 1 ? "" : "s"}`,
                  label: (
                    <>
                      {AGENDA_MAILBOX_LABEL[id]}
                      <span aria-hidden="true" className="text-label-secondary tabular-nums">
                        {count}
                      </span>
                    </>
                  ),
                }))}
              />
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col" aria-busy="true" aria-label="Loading agenda">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex min-h-16 items-center gap-3 py-2">
                  <Skeleton className="size-4 shrink-0 rounded-xs" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : visible.length > 0 ? (
            <FacetList variant="plain" className="max-h-[420px] overflow-y-auto">
              <FacetListSection aria-label={`${AGENDA_MAILBOX_LABEL[activeMailbox]} inbox`}>
                {visible.map((view) => (
                  <InboxRow
                    key={view.item.id}
                    view={view}
                    nowMs={inbox.nowMs}
                    onOpen={() => open(view)}
                    swipeActions={swipeFor(view)}
                  />
                ))}
              </FacetListSection>
            </FacetList>
          ) : (
            <EmptyState
              compact
              icon={<MailOpen />}
              title="Inbox zero"
              message={
                items.length === 0
                  ? "Open issues, active directives and upcoming elections land here. Set your government's next priority with a directive."
                  : "You're on top of everything. Snoozed items come back on their own, and anything that changes returns here."
              }
              action={
                <Button type="button" variant="secondary" onClick={() => onIssueDirective?.()}>
                  <Command aria-hidden="true" />
                  Declare Directive
                </Button>
              }
            />
          )}

          {archivedViews.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="plain"
                size="sm"
                aria-expanded={showArchived}
                aria-controls={archivedId}
                onClick={() => setShowArchived((v) => !v)}
                className="self-start px-0 hover:bg-transparent"
              >
                {showArchived ? "Hide snoozed and done" : describeArchived(archivedViews)}
              </Button>
              {showArchived ? (
                <FacetList variant="plain" id={archivedId}>
                  <FacetListSection aria-label="Snoozed and done">
                    {archivedViews.map((view) => (
                      <InboxRow
                        key={view.item.id}
                        view={view}
                        nowMs={inbox.nowMs}
                        onOpen={() => setOpenId(view.item.id)}
                      />
                    ))}
                  </FacetListSection>
                </FacetList>
              ) : null}
            </div>
          ) : null}
        </FacetCardContent>
      </FacetCard>

      <AgendaEventActionDialog
        selectedEvent={openView?.item ?? null}
        placement={openView?.placement}
        nowMs={inbox.nowMs}
        onClose={() => setOpenId(null)}
        onIssueDirective={onIssueDirective}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
        onMarkUnread={(item) => inbox.setRead([item], false)}
        onMarkDone={inbox.markDone}
        onSnooze={inbox.snooze}
        onMoveToInbox={inbox.moveToInbox}
      />
    </>
  );
}

function describeArchived(views: InboxView[]): string {
  const snoozed = views.filter((v) => v.placement === "snoozed").length;
  const done = views.length - snoozed;
  return `Show ${[snoozed ? `${snoozed} snoozed` : null, done ? `${done} done` : null]
    .filter(Boolean)
    .join(" and ")}`;
}

/** One inbox row: unread dot + source glyph, title (bold when unread), preview, relative time. */
function InboxRow({
  view,
  nowMs,
  onOpen,
  swipeActions,
}: {
  view: InboxView;
  nowMs: number;
  onOpen: () => void;
  swipeActions?: FacetRowSwipeActions;
}) {
  const { item, read, placement } = view;
  const unread = !read && placement === "inbox";
  const Icon = item.icon;
  const time =
    placement === "snoozed"
      ? "Snoozed"
      : placement === "done"
        ? "Done"
        : formatInboxTime(item, nowMs);
  const pressing =
    placement === "inbox" && (item.urgency === "overdue" || item.urgency === "due-soon");

  return (
    <FacetRow
      onClick={onOpen}
      className="pl-0"
      swipeActions={swipeActions}
      leading={
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            data-slot="unread-dot"
            className={cn("size-2 shrink-0 rounded-full", unread ? "bg-tint" : "bg-transparent")}
          />
          <Icon aria-hidden="true" className={cn("size-4 shrink-0", STATUS_TEXT[item.tone])} />
        </span>
      }
      title={
        <span className="flex min-w-0 items-center gap-2">
          {unread ? <span className="sr-only">Unread: </span> : null}
          <span
            className={cn(
              "line-clamp-1 min-w-0",
              unread ? "text-label font-semibold" : "text-label font-normal",
              placement !== "inbox" && "text-label-secondary"
            )}
          >
            {item.title}
          </span>
          {item.flagged && placement === "inbox" ? (
            <TriangleFlag
              role="img"
              aria-label="Needs action"
              className={cn(
                "size-3.5 shrink-0",
                item.tone === "warning" ? STATUS_TEXT.warning : "text-destructive"
              )}
            />
          ) : null}
        </span>
      }
      subtitle={
        <span className="line-clamp-1">
          <span className={cn("font-medium", STATUS_TEXT[item.tone])}>{item.statusLabel}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">. </span>
          {item.preview}
        </span>
      }
      trailing={
        time ? (
          <span
            className={cn(
              "text-footnote tabular-nums",
              pressing
                ? cn(
                    "font-medium",
                    item.urgency === "overdue" ? "text-destructive" : STATUS_TEXT.warning
                  )
                : "text-label-secondary"
            )}
          >
            {time}
          </span>
        ) : undefined
      }
    />
  );
}

export const ExecutiveAgenda = React.memo(ExecutiveAgendaComponent);
export const V2MyAgenda = ExecutiveAgenda;
export type { ExecutiveAgendaProps } from "./agenda";
