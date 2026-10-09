import type { RouterOutputs } from "~/trpc/react";

export type ForumAuthors = RouterOutputs["thinkpagesForum"]["thread"]["authors"];

interface AuthorNameProps {
  authors: ForumAuthors;
  /** Null on imported content whose XenForo author has no IxStats account (phase 4). */
  userId: string | null;
  personaId: string | null;
  /** The XenForo name kept on imported content. */
  importedName?: string | null;
}

/**
 * Who wrote a thread or post, as plain text. A persona post shows the persona's name and
 * @username only, never the player behind it. Otherwise the member's name, else the imported
 * XenForo name, else "Member".
 */
export function AuthorName({ authors, userId, personaId, importedName }: AuthorNameProps) {
  const persona = personaId ? authors.personas[personaId] : undefined;
  if (persona) {
    return (
      <span className="min-w-0 truncate">
        <span className="text-label font-medium">{persona.displayName}</span>{" "}
        <span className="text-label-secondary">@{persona.username}</span>
      </span>
    );
  }
  // A persona post whose persona is gone still must not name the player (nor an imported name).
  const userName = userId ? authors.users[userId]?.name : undefined;
  const name = personaId ? undefined : (userName ?? importedName);
  return <span className="text-label min-w-0 truncate font-medium">{name ?? "Member"}</span>;
}
