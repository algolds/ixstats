"use client";

import Link from "next/link";
import { Globe } from "iconoir-react";
import { RealmAvatar } from "~/components/realms/RealmAvatar";
import type { RouterOutputs } from "~/trpc/react";
import { Pane, PaneBody, type PaneQuery } from "./Pane";

type OpenRealm = RouterOutputs["frontPage"]["get"]["openRealms"][number];

/** Realms with nations nobody owns yet, most open first. */
export function OpenRealmsPane({ realms, query }: { realms: OpenRealm[]; query: PaneQuery }) {
  return (
    <Pane
      app="realms"
      icon={<Globe />}
      title="Realms with open nations"
      link={{ href: "/realms", label: "All realms" }}
    >
      <PaneBody
        query={query}
        what="realms"
        empty={realms.length === 0 ? "No open nations right now." : null}
      >
        <ul className="-mx-2">
          {realms.map((realm) => (
            <li key={realm.slug}>
              <Link
                href={`/r/${encodeURIComponent(realm.slug)}`}
                className="hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm flex items-center gap-3 px-2 py-2 focus-visible:outline-2 pointer-coarse:min-h-11"
              >
                <RealmAvatar thumbnail={realm.thumbnail} />
                <span className="min-w-0 flex-1">
                  <span className="text-body text-label block truncate font-medium">
                    {realm.name}
                  </span>
                  <span className="text-footnote text-label-secondary block tabular-nums">
                    {`${realm.openNationCount.toLocaleString()} open ${realm.openNationCount === 1 ? "nation" : "nations"}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PaneBody>
    </Pane>
  );
}
