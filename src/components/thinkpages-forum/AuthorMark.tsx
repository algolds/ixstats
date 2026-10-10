import type { ForumAuthors } from "./AuthorName";
import { ForumAvatar, type ForumAvatarSize } from "./ForumAvatar";

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
