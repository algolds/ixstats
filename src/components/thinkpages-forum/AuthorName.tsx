import type { RouterOutputs } from "~/trpc/react";

export type ForumAuthors = RouterOutputs["thinkpagesForum"]["thread"]["authors"];

interface AuthorNameProps {
  authors: ForumAuthors;
  userId: string;
  personaId: string | null;
}

/**
 * Who wrote a thread or post, as plain text. A persona post shows the persona's name and
 * @username only, never the player behind it.
 */
export function AuthorName({ authors, userId, personaId }: AuthorNameProps) {
  const persona = personaId ? authors.personas[personaId] : undefined;
  if (persona) {
    return (
      <span className="min-w-0 truncate">
        <span className="text-label font-medium">{persona.displayName}</span>{" "}
        <span className="text-label-secondary">@{persona.username}</span>
      </span>
    );
  }
  // A persona post whose persona is gone still must not name the player.
  const name = personaId ? undefined : authors.users[userId]?.name;
  return <span className="text-label min-w-0 truncate font-medium">{name ?? "Member"}</span>;
}
