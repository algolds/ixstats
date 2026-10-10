"use client";

import Link from "next/link";
import { Book, ChatBubble, Group } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import { relatedWikiTitles } from "~/lib/thinkpages-forum/post-html";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { AuthorMark } from "../AuthorMark";
import { AuthorName } from "../AuthorName";
import { RailPanel } from "../shell";
import type { ThreadData } from "./types";

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dd className="text-title-2 text-tint tabular-nums">{value}</dd>
      <dt className="text-footnote text-label-secondary">{label}</dt>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-separator flex items-center justify-between gap-3 border-t py-2.5">
      <dt className="text-callout text-label-secondary">{label}</dt>
      <dd className="text-callout min-w-0 truncate">{children}</dd>
    </div>
  );
}

/** Replies, participants and the last reply; the board, when it started and whether it is open. */
function ThisThreadPanel({ data }: { data: ThreadData }) {
  const { thread, category, total, participants } = data;
  const replies = Math.max(0, total - 1);
  const status = thread.archived ? "Archived" : thread.locked ? "Locked" : "Open";
  return (
    <RailPanel title="This thread" icon={<ChatBubble />}>
      <div className="space-y-3">
        <dl className="grid grid-cols-3 gap-3">
          <Figure value={String(replies)} label="Replies" />
          <Figure value={String(participants.length)} label="Participants" />
          <Figure
            value={replies > 0 ? timeAgo(thread.lastPostAt, { suffix: false }) : "None"}
            label="Last reply"
          />
        </dl>
        <dl>
          <Fact label="Category">{category.name}</Fact>
          <Fact label="Started">
            <span className="tabular-nums">
              {thread.createdAt.toLocaleDateString(undefined, { dateStyle: "medium" })}
            </span>
          </Fact>
          <Fact label="Status">
            <Badge>{status}</Badge>
          </Fact>
        </dl>
      </div>
    </RailPanel>
  );
}

/** The thread's most active posters, each with their flag (a persona shows the persona only). Left out when empty. */
function ParticipantsPanel({ data }: { data: ThreadData }) {
  const { participants, authors } = data;
  return (
    <RailPanel title="Participants" icon={<Group />}>
      {participants.length > 0 ? (
        <ul className="-mx-2">
          {participants.map((participant) => (
            <li
              key={`${participant.authorPersonaId ?? participant.authorUserId ?? participant.importedAuthorName}`}
              className="flex items-center gap-3 px-2 py-2 pointer-coarse:min-h-11"
            >
              <AuthorMark
                authors={authors}
                userId={participant.authorUserId}
                personaId={participant.authorPersonaId}
                importedName={participant.importedAuthorName}
              />
              <span className="text-callout flex min-w-0 flex-1">
                <AuthorName
                  authors={authors}
                  userId={participant.authorUserId}
                  personaId={participant.authorPersonaId}
                  importedName={participant.importedAuthorName}
                />
              </span>
              <span className="text-callout text-label-secondary tabular-nums">
                {`${participant.posts} ${participant.posts === 1 ? "post" : "posts"}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </RailPanel>
  );
}

/** Wiki pages the thread's first post links to. Left out when there are none. */
function RelatedPanel({ titles }: { titles: readonly string[] }) {
  return (
    <RailPanel title="Related on the wiki" icon={<Book />}>
      {titles.length > 0 ? (
        <ul className="-mx-2">
          {titles.map((title) => (
            <li key={title}>
              <Link
                href={titleToWikiOSRoute(title)}
                className="text-callout hover:bg-fill-4 focus-visible:outline-tint block truncate rounded-control px-2 py-2 focus-visible:outline-2 pointer-coarse:min-h-11"
              >
                {title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </RailPanel>
  );
}

/** The thread page's rail: the thread at a glance, who took part, and the wiki pages its first post links to. */
export function ThreadRail({ data }: { data: ThreadData }) {
  // Only the thread's own first post (page 1) names what the thread is about.
  const first = data.posts[0]?.number === 1 ? data.posts[0] : undefined;
  return (
    <>
      <ThisThreadPanel data={data} />
      <ParticipantsPanel data={data} />
      <RelatedPanel titles={first ? relatedWikiTitles(first.contentHtml) : []} />
    </>
  );
}
