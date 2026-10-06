"use client";

import { useState } from "react";
import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { createUrl } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
import { RealmAvatar } from "./RealmAvatar";
import { plural, realmHref, realmMatches, type DirectoryRealm } from "./realm-directory";

type NationHit = RouterOutputs["realms"]["searchNations"][number];

/** The fewest characters a nation search sends (the procedure's minimum). */
const NATION_QUERY_MIN = 2;
/** Realm matches shown before "and N more". */
const REALM_HITS_SHOWN = 6;

function NationRow({ nation }: { nation: NationHit }) {
  const nationsTab = createUrl(realmHref(nation.realm.slug, "nations"));
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
            href={createUrl(`/countries/${nation.slug ?? nation.id}`)}
            className="text-label text-body block truncate hover:underline"
          >
            {nation.name}
          </Link>
        ) : (
          <span className="text-label text-body block truncate">{nation.name}</span>
        )}
        <p className="text-label-secondary text-footnote truncate">
          {nation.kind === "page" ? "Nation page in " : "In "}
          <Link href={createUrl(realmHref(nation.realm.slug))} className="hover:underline">
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
      <h3 className="text-label text-headline">Nations</h3>
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

function RealmResults({ realms, query }: { realms: DirectoryRealm[]; query: string }) {
  const hits = realms.filter((realm) => realmMatches(realm, query));
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-label text-headline">Realms</h3>
      {hits.length === 0 ? (
        <p className="text-label-secondary text-footnote">No realm matches.</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label="Matching realms">
          {hits.slice(0, REALM_HITS_SHOWN).map((realm) => (
            <li key={realm.id}>
              <Link
                href={createUrl(realmHref(realm.slug))}
                className="hover:bg-fill-3 rounded-row flex items-center gap-3 p-2"
              >
                <RealmAvatar thumbnail={realm.thumbnail} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="text-label text-body block truncate">{realm.name}</span>
                  <span className="text-label-secondary text-footnote block truncate">
                    {plural(realm.nationCount, "nation")}
                    {realm.tags.length > 0 && ` · ${realm.tags.join(", ")}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {hits.length > REALM_HITS_SHOWN && (
            <li className="text-label-secondary text-footnote p-2">
              and {plural(hits.length - REALM_HITS_SHOWN, "more realm")} below
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** One search for realms (name, description, tags) and nations across the open realms. */
export function RealmSearch({ realms }: { realms: DirectoryRealm[] | undefined }) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  return (
    <section
      aria-labelledby="realm-search-heading"
      className="border-separator bg-surface rounded-card border p-4 md:p-6"
    >
      <h2 id="realm-search-heading" className="text-label text-title-3 mb-3">
        Search
      </h2>
      <SearchField
        value={query}
        onValueChange={setQuery}
        placeholder="Find a realm or a nation"
        aria-label="Search realms and nations"
      />
      {searching ? (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <RealmResults realms={realms ?? []} query={query} />
          <NationResults query={query} />
        </div>
      ) : (
        <p className="text-label-secondary text-footnote mt-2">
          Search realms by name, description or tag, and nations in every open realm.
        </p>
      )}
    </section>
  );
}
