"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { bondHref, companyHref, nationHref } from "~/lib/exchange/routes";
import { ChangeLabel, ageLabel } from "./brand";

/** One story: who reported it, when, what moved, and what it is about. */
export function StoryPage({ newsId }: { newsId: string }) {
  const { data, isLoading, error } = api.exchange.story.useQuery({ newsId });
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data)
    return (
      <EmptyState title="Story not found" message={error?.message ?? "It may have been removed."} />
    );
  const subjects = [
    data.companyId ? { href: companyHref(data.companyId), label: "The company" } : null,
    data.bondId ? { href: bondHref(data.bondId), label: "The bond" } : null,
    data.countryId ? { href: nationHref(data.countryId), label: "The nation" } : null,
  ].filter((s) => s !== null);
  return (
    <Card content="prose" padding="lg" className="max-w-2xl space-y-3">
      <p className="text-footnote text-label-secondary">
        {data.sourceName} · {ageLabel(data.createdAt)} ago
      </p>
      <h1 className="text-title-1 text-label">{data.headline}</h1>
      {data.movePct !== null && (
        <p className="text-footnote">
          <ChangeLabel pct={data.movePct} />{" "}
          <span className="text-label-secondary">on the news</span>
        </p>
      )}
      {data.body && <p className="text-body">{data.body}</p>}
      {subjects.length > 0 && (
        <p className="text-footnote flex gap-4">
          {subjects.map((s) => (
            <Link key={s.href} href={s.href} className="text-tint">
              {s.label}
            </Link>
          ))}
        </p>
      )}
    </Card>
  );
}
