"use client";

import Link from "next/link";
import { Clock, Globe, Group as Users } from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";

/**
 * The profile card on a `User:<name>` page: the wiki user's linked IxStats country, and links to
 * their passport and contributions. A user page that does not exist yet shows the card alone with
 * `pageExists={false}`.
 */
export function UserProfileCard({
  username,
  pageExists,
}: {
  /** The wiki user name (spaces, not underscores). */
  username: string;
  pageExists: boolean;
}) {
  const { data: author } = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: username },
    { staleTime: 60_000 }
  );
  const country = author?.country ?? null;

  return (
    <aside
      aria-label={`Profile of ${username}`}
      className="border-separator bg-surface rounded-card text-body mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        {country?.flag ? (
          <UnifiedCountryFlag
            showTooltip={false}
            countryName={country.name ?? ""}
            size="sm"
            className="shrink-0"
          />
        ) : (
          <span className="bg-wiki/10 flex h-7 w-7 shrink-0 items-center justify-center rounded">
            <Users className="text-wiki h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-foreground truncate font-semibold">{username}</p>
          {country && (
            <p className="text-muted-foreground truncate text-xs">
              {country.name}
              {country.continent ? ` · ${country.continent}` : ""}
            </p>
          )}
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <Link
          href={getWikiProfilePath(username)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Globe className="h-3 w-3" />
          IxnayID profile
        </Link>
        <Link
          href={`/util/contributions/${encodeURIComponent(username)}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Clock className="h-3 w-3" />
          Contributions
        </Link>
      </nav>
      {!pageExists && (
        <p className="text-muted-foreground basis-full text-xs italic">
          This user has no user page yet.
        </p>
      )}
    </aside>
  );
}
