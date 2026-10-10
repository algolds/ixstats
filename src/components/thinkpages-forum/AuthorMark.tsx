import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import type { ForumAuthors } from "./AuthorName";

/** Up to two capital letters from a name, for an avatar without a picture. */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase());
  return letters.join("") || "?";
}

interface AuthorMarkProps {
  authors: ForumAuthors;
  userId: string | null;
  personaId: string | null;
  importedName?: string | null;
}

/**
 * Who wrote it, as a small avatar and (for a member) their country's flag. A persona shows the persona's picture
 * and never a flag, and a persona thread never looks up its player, even when the id is present (a moderator's read).
 */
export function AuthorMark({ authors, userId, personaId, importedName }: AuthorMarkProps) {
  const persona = personaId ? authors.personas[personaId] : undefined;
  const user = !personaId && userId ? authors.users[userId] : undefined;
  const name = persona?.displayName ?? user?.name ?? importedName ?? "Member";
  const avatarUrl = persona?.avatarUrl ?? user?.avatarUrl ?? null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <Avatar className="size-5">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-caption text-label-secondary">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      {user?.flagUrl ? (
        <Avatar className="rounded-control-sm h-3.5 w-5">
          <AvatarImage src={user.flagUrl} alt="" />
          <AvatarFallback className="rounded-control-sm" />
        </Avatar>
      ) : null}
    </span>
  );
}
