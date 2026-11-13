"use client";

import Link from "next/link";
import { ArrowUpRight, Journal } from "iconoir-react";
import { api } from "~/trpc/react";
import { EmptyState } from "~/components/ui/empty-state";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { bondHref, companyHref, nationHref } from "~/lib/exchange/routes";
import { ChangeLabel, ExchangeIconWell, ageLabel } from "./brand";

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
    <LensCard app="exchange" content="prose" padding="lg" className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2.5">
        <ExchangeIconWell size="sm">
          <Journal />
        </ExchangeIconWell>
        <p className="text-footnote text-label-secondary font-medium">
          {data.sourceName} · {ageLabel(data.createdAt)} ago
        </p>
      </div>
      <h1 className="text-title-1 text-label font-bold tracking-tight">{data.headline}</h1>
      {data.movePct !== null && (
        <p className="facet-well rounded-control text-footnote inline-flex items-center gap-1.5 px-3 py-1.5">
          <ChangeLabel pct={data.movePct} />{" "}
          <span className="text-label-secondary">on the news</span>
        </p>
      )}
      {data.body && <p className="text-body text-label leading-relaxed">{data.body}</p>}
      {subjects.length > 0 && (
        <div className="border-separator flex flex-wrap gap-2.5 border-t pt-3 text-footnote">
          {subjects.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="facet-press facet-press-subtle bg-tint-fill text-tint hover:bg-tint/20 rounded-full inline-flex items-center gap-1 px-3 py-1 font-medium transition-colors"
            >
              <span>{s.label}</span>
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </LensCard>
  );
}
