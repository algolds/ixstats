import Link from "next/link";
import { Link as LinkIcon } from "iconoir-react";
import { PersonaAuthorCard } from "~/components/thinkpages/PersonaAuthorCard";
import { Badge } from "~/components/ui/badge";
import { postHref } from "~/lib/thinkpages-forum/links";
import { ForumAvatar } from "../ForumAvatar";

export type PostRole = "staff" | "officer" | "starter";

const ROLE_LABEL: Record<PostRole, string> = {
  staff: "Staff",
  officer: "Officer",
  starter: "Thread starter",
};

interface PostHeaderProps {
  name: string;
  /** Shown as `@handle` under the name (a persona's username, a member's Passport handle). */
  handle: string | null;
  avatarUrl: string | null;
  flagUrl: string | null;
  /** The one role the server chose (staff, then officer, then thread starter); never set for a persona's player. */
  role: PostRole | null;
  createdAt: Date;
  editedAt: Date | null;
  /** The post's 1-based position in the thread as this viewer sees it. */
  number: number;
  postId: string;
  /** An imported post whose author has no account here. */
  imported: boolean;
  /** A persona's username: the name opens the persona's hover card. */
  personaUsername?: string;
  /** Moderators only: the post is hidden from members. */
  hidden?: boolean;
}

const formatDate = (date: Date) =>
  date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** A post's header: avatar, name and flag, its role pill, handle and full date, and its `#N` permalink. */
export function PostHeader({
  name,
  handle,
  avatarUrl,
  flagUrl,
  role,
  createdAt,
  editedAt,
  number,
  postId,
  imported,
  personaUsername,
  hidden = false,
}: PostHeaderProps) {
  const title = <span className="text-title-3 text-label min-w-0 truncate">{name}</span>;
  return (
    <header className="flex items-center gap-3">
      <ForumAvatar name={name} avatarUrl={avatarUrl} size="md" className="sm:size-10" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {personaUsername ? (
            <PersonaAuthorCard username={personaUsername}>{title}</PersonaAuthorCard>
          ) : (
            title
          )}
          {flagUrl ? (
            <img
              src={flagUrl}
              alt=""
              width={18}
              height={12}
              className="rounded-control-sm h-3 w-[18px] shrink-0 object-cover"
            />
          ) : null}
          {role ? <Badge variant="secondary">{ROLE_LABEL[role]}</Badge> : null}
          {imported ? <Badge variant="outline">Old forum</Badge> : null}
          {hidden ? <Badge variant="warning">Hidden</Badge> : null}
        </div>
        <p className="text-footnote text-label-secondary tabular-nums">
          {handle ? `@${handle} · ` : null}
          <time dateTime={createdAt.toISOString()}>{formatDate(createdAt)}</time>
          {editedAt ? " · edited" : null}
        </p>
      </div>
      <Link
        href={postHref(postId)}
        className="text-caption text-label-tertiary hover:text-label focus-visible:outline-tint inline-flex shrink-0 items-center gap-1 tabular-nums focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
      >
        <LinkIcon aria-hidden className="size-3.5" />#{number}
      </Link>
    </header>
  );
}
