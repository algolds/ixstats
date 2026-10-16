import type { ReactNode } from "react";
import { PersonaAuthorCard } from "~/components/thinkpages/PersonaAuthorCard";
import type { PersonaType } from "~/lib/thinkpages-forum/persona-type";
import type { ForumAuthors } from "./AuthorName";
import { ForumAvatar, type ForumAvatarSize } from "./ForumAvatar";
import { PersonaTypeChip } from "./PersonaTypeChip";

interface AuthorRef {
  authors: ForumAuthors;
  userId: string | null;
  personaId: string | null;
  importedName?: string | null;
}

/**
 * The author as a listing may show them. A persona is the persona's name and picture and never a flag, and a persona
 * thread never looks up its player, even when the id is present (a moderator's read).
 */
export function resolveAuthor({ authors, userId, personaId, importedName }: AuthorRef) {
  const persona = personaId ? authors.personas[personaId] : undefined;
  const user = !personaId && userId ? authors.users[userId] : undefined;
  return {
    name: persona?.displayName ?? user?.name ?? importedName ?? "Member",
    avatarUrl: persona?.avatarUrl ?? user?.avatarUrl ?? null,
    flagUrl: user?.flagUrl ?? null,
  };
}

/** A member's country flag, small enough to sit in a line of text. */
export function AuthorFlag({ url }: { url: string }) {
  return (
    <img
      src={url}
      alt=""
      width={18}
      height={12}
      className="rounded-control-sm h-3 w-[18px] shrink-0 object-cover"
    />
  );
}

interface AuthorMarkProps extends AuthorRef {
  size?: ForumAvatarSize;
}

/** Who wrote it, as a small avatar and (for a member) their country's flag. */
export function AuthorMark({ size = "xs", ...ref }: AuthorMarkProps) {
  const { name, avatarUrl, flagUrl } = resolveAuthor(ref);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <ForumAvatar name={name} avatarUrl={avatarUrl} size={size} />
      {flagUrl ? <AuthorFlag url={flagUrl} /> : null}
    </span>
  );
}

interface AuthorLineProps {
  name: string;
  /** A persona's username: the name opens the persona's hover card and `@username` follows it. */
  personaUsername?: string | null;
  personaType: PersonaType | null;
  /** A member's flag; always null for a persona, which never shows its nation. */
  flagUrl: string | null;
  /** Role, visitor and moderation badges, and the time, after the name. */
  children?: ReactNode;
}

/**
 * Who wrote a post, the same on every forum surface: the name in headline type (a persona's opens its hover card,
 * then its @username), a member's flag or a persona's voice chip, then whatever the surface adds.
 */
export function AuthorLine({
  name,
  personaUsername,
  personaType,
  flagUrl,
  children,
}: AuthorLineProps) {
  const title = <span className="text-headline text-label min-w-0 truncate">{name}</span>;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      {personaUsername ? (
        <>
          <PersonaAuthorCard username={personaUsername}>{title}</PersonaAuthorCard>
          <span className="text-footnote text-label-secondary">@{personaUsername}</span>
        </>
      ) : (
        title
      )}
      {flagUrl ? <AuthorFlag url={flagUrl} /> : null}
      {personaType ? <PersonaTypeChip type={personaType} /> : null}
      {children}
    </div>
  );
}
