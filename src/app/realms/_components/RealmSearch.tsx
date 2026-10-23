"use client";

import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
import { Card } from "~/components/ui/card";
import { realmHref } from "./realm-directory";

type NationHit = RouterOutputs["realms"]["searchNations"][number];

/** The fewest characters a nation search sends (the procedure's minimum). */
const NATION_QUERY_MIN = 2;

function NationRow({ nation }: { nation: NationHit }) {
  const nationsTab = realmHref(nation.realm.slug, "nations");
  return (
    <li className="flex items-center gap-3 py-2">
      {nation.flag ? (
        <img src={nation.flag} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
      ) : (
        <span className="bg-fill-3 h-4 w-6 shrink-0 rounded-sm" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        {nation.kind === "country" ? (
          <Link
            href={`/countries/${nation.slug ?? nation.id}`}
            className="text-label text-body block truncate hover:underline"
          >
            {nation.name}
          </Link>
        ) : (
          <span className="text-label text-body block truncate">{nation.name}</span>
        )}
        <p className="text-label-secondary text-footnote truncate">
          {nation.kind === "page" ? "Nation page in " : "In "}
          <Link href={realmHref(nation.realm.slug)} className="hover:underline">
            {nation.realm.name}
          </Link>
        </p>
      </div>
      {nation.claimable ? (
        <Link href={nationsTab} className="shrink-0" aria-label={`Claim ${nation.name}`}>
          <Badge variant="success">Claimable</Badge>
        </Link>
      ) : (
        <Badge variant="default">Claimed</Badge>
      )}
    </li>
  );
}

function NationResults({ query }: { query: string }) {
  const debounced = useDebounce(query.trim(), 250);
  const ready = debounced.length >= NATION_QUERY_MIN;
  const { data: nations, isLoading } = api.realms.searchNations.useQuery(
    { query: debounced },
    { enabled: ready }
  );

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-label text-headline">Nations</h2>
      {query.trim().length < NATION_QUERY_MIN ? (
        <p className="text-label-secondary text-footnote">
          Type at least {NATION_QUERY_MIN} letters to find nations.
        </p>
      ) : !ready || isLoading ? (
        <p className="text-label-secondary text-footnote">Searching nations…</p>
      ) : !nations?.length ? (
        <p className="text-label-secondary text-footnote">No nation matches in the open realms.</p>
      ) : (
        <ul className="divide-separator flex flex-col divide-y" aria-label="Matching nations">
          {nations.map((nation) => (
            <NationRow key={`${nation.kind}:${nation.id}`} nation={nation} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One search box for the atlas and the nations of every open realm. The query is the page's: the atlas filters
 * its realms by it, and this card lists the matching nations.
 */
export function RealmSearch({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <Card content="input" padding="md" className="flex flex-col gap-3">
      <SearchField
        value={query}
        onValueChange={onQueryChange}
        placeholder="Find a realm or a nation"
        aria-label="Search realms and nations"
      />
      {query.trim().length > 0 && <NationResults query={query} />}
    </Card>
  );
}
