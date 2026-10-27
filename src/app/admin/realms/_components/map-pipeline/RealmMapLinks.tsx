"use client";

import Link from "next/link";
import { NavArrowRight } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

/** /admin/realms "Map": a link per realm to its page in Atlas, where its map pipeline lives. */
export function RealmMapLinks() {
  const { data: realms, isLoading, error, refetch } = api.realms.adminListRealms.useQuery();

  if (isLoading) return <p className="text-label-secondary text-body">Loading realms…</p>;
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-body" role="alert">
          {error.message}
        </p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!realms || realms.length === 0) {
    return <p className="text-label-secondary text-body">Create a realm first.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-secondary text-footnote">
        Each realm&apos;s map pipeline, relief and jobs are on its page in Atlas.
      </p>
      <Card content="navigation" className="divide-separator divide-y">
        {realms.map((realm) => (
          <Link
            key={realm.id}
            href={`/admin/maps/realms/${encodeURIComponent(realm.slug)}`}
            className="text-label text-body flex items-center justify-between px-4 py-3"
          >
            <span>{realm.name}</span>
            <NavArrowRight aria-hidden className="text-label-secondary size-4" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
