import Link from "next/link";
import { Link as LinkIcon } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import { IxTime } from "~/lib/ixtime";
import { postHref } from "~/lib/thinkpages-forum/links";
import type { PersonaType } from "~/lib/thinkpages-forum/persona-type";
import { AuthorLine } from "../AuthorMark";
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
  /** A persona's voice; null for a member, an imported author or a personal account. */
  personaType: PersonaType | null;
  /** Moderators only: the post is hidden from members. */
  hidden?: boolean;
}

const absolute = (date: Date) =>
  `${date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · IxTime ${IxTime.formatIxTime(
    IxTime.convertToIxTime(date.getTime())
  )}`;

/**
 * A post's header: the avatar, the shared author line (name, flag or voice chip, role and state badges), the relative
 * time under it, and the post's `#N` permalink. It has no band of its own; the feed's one Pane is the surface.
 */
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
  personaType,
  hidden = false,
}: PostHeaderProps) {
  return (
    <header className="flex items-center gap-3">
      <ForumAvatar name={name} avatarUrl={avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <AuthorLine
          name={name}
          personaUsername={personaUsername}
          personaType={personaType}
          flagUrl={flagUrl}
        >
          {role ? <Badge variant="secondary">{ROLE_LABEL[role]}</Badge> : null}
          {imported ? <Badge variant="outline">Old forum</Badge> : null}
          {hidden ? <Badge variant="warning">Hidden</Badge> : null}
        </AuthorLine>
        <p className="text-footnote text-label-secondary tabular-nums">
          {handle && !personaUsername ? `@${handle} · ` : null}
          <time dateTime={createdAt.toISOString()} title={absolute(createdAt)}>
            {timeAgo(createdAt, { suffix: false })}
          </time>
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
