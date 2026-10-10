"use client";

import Link from "next/link";
import { timeAgo } from "~/lib/format/compact";
import { postHref, threadHref } from "~/lib/thinkpages-forum/links";
import { MOD_LOG_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import { memberName, ModPanel, ModRow, placeName, type Members, type PanelProps } from "./ModRow";

type Entry = RouterOutputs["thinkpagesForumMod"]["log"]["rows"][number];

/** Each logged action as copy; an action missing here shows as stored. */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  "thread.lock": "Locked thread",
  "thread.unlock": "Unlocked thread",
  "thread.pin": "Pinned thread",
  "thread.unpin": "Unpinned thread",
  "thread.hide": "Hid thread",
  "thread.unhide": "Unhid thread",
  "thread.archive": "Archived thread",
  "thread.unarchive": "Unarchived thread",
  "thread.move": "Moved thread",
  "post.hide": "Hid post",
  "post.unhide": "Unhid post",
  "post.edit": "Edited post",
  "post.continue": "Continued post in a thread",
  "report.resolve": "Resolved report",
  "report.dismiss": "Dismissed report",
  "warning.issue": "Warned member",
  "warning.revoke": "Revoked warning",
  "ban.issue": "Banned member",
  "ban.lift": "Lifted ban",
  "ban.auto": "Automatic ban",
  "ban.extend": "Extended automatic ban",
  "ban.shorten": "Shortened automatic ban",
  "ban.retier": "Re-tiered automatic ban",
  "ban.migrate": "Carried over board ban",
  "appeal.review": "Reviewed appeal",
  "appeal.moot": "Closed appeal",
  "moderator.grant": "Appointed category moderator",
  "moderator.revoke": "Removed category moderator",
};

const text = (value: string | number | boolean | null | undefined): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** The thread or post an entry acted on, when the entry says where it is. */
function targetLink(entry: Entry): { href: string; label: string } | null {
  const detail: NonNullable<Entry["detail"]> = entry.detail ?? {};
  if (entry.targetType === "thread") {
    return { href: threadHref(entry.targetId), label: "Open thread" };
  }
  if (entry.targetType === "post") {
    return { href: postHref(entry.targetId), label: "Open post" };
  }
  if (entry.targetType === "report") {
    const reported = text(detail.targetId);
    if (reported && detail.targetType === "thread") {
      return { href: threadHref(reported), label: "Open thread" };
    }
    if (reported && detail.targetType === "post") {
      return { href: postHref(reported), label: "Open post" };
    }
  }
  return null;
}

/** The moderation log in the viewer's scope (optionally one realm's), newest first. Append-only, so read-only. */
export function ModLogPanel({ context, realm, page, basePath }: PanelProps) {
  const query = api.thinkpagesForumMod.log.useQuery({ realm, page });
  const rows = query.data?.rows ?? [];
  return (
    <ModPanel
      label="Moderation log"
      column="Action"
      query={query}
      rowCount={rows.length}
      emptyTitle="Nothing logged yet"
      paging={{ total: query.data?.total, perPage: MOD_LOG_PER_PAGE, page, basePath }}
    >
      {rows.map((entry) => (
        <LogRow
          key={entry.id}
          entry={entry}
          members={query.data?.authors}
          place={placeName(context, entry.scope, entry.scopeId)}
        />
      ))}
    </ModPanel>
  );
}

function LogRow({
  entry,
  members,
  place,
}: {
  entry: Entry;
  members: Members | undefined;
  place: string;
}) {
  const link = targetLink(entry);
  const note = text(entry.detail?.note);
  return (
    <ModRow
      title={ACTION_LABELS[entry.action] ?? entry.action}
      meta={[
        memberName(members, entry.actorId),
        entry.targetType === "user" ? `Member: ${memberName(members, entry.targetId)}` : null,
        place,
      ]}
      when={timeAgo(entry.createdAt)}
      actions={
        link ? (
          <Link
            href={link.href}
            className="text-footnote text-tint-ink hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {link.label}
          </Link>
        ) : null
      }
    >
      {note ? <p className="text-callout text-label break-words">{note}</p> : null}
    </ModRow>
  );
}
