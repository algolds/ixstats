"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, Building, Coins, Journal, StatUp } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import type { NewsItem } from "~/lib/exchange/terminal";
import { storyHref } from "~/lib/exchange/routes";
import { cn } from "~/lib/utils";
import { ChangeLabel, ExchangeIconWell, TickerTile, ageLabel, symbolOf, toneOf } from "./brand";

function storyLeading(item: NewsItem, emphasis: "headline" | "compact") {
  if (emphasis === "headline" && item.companyId) {
    const tone =
      item.movePct !== null
        ? toneOf(item.movePct) === "gain"
          ? "gain"
          : toneOf(item.movePct) === "loss"
            ? "loss"
            : "tint"
        : "tint";
    return <TickerTile code={symbolOf(item.sourceName)} tone={tone} size="md" className="mt-0.5" />;
  }
  const icon =
    item.bondId || item.kind === "dividend" || item.kind === "bond" ? (
      <Coins />
    ) : item.kind === "trade" || item.movePct !== null ? (
      <StatUp />
    ) : item.companyId ? (
      <Building />
    ) : item.prominence === "HEADLINE" ? (
      <Journal />
    ) : (
      <Activity />
    );
  return (
    <ExchangeIconWell size={emphasis === "headline" ? "md" : "sm"} className="mt-0.5">
      {icon}
    </ExchangeIconWell>
  );
}

/** Business stories (`headline`) or live activity (`compact`), each linking its story page. */
export function NewsList({
  items,
  emphasis,
  empty,
}: {
  items: readonly NewsItem[];
  emphasis: "headline" | "compact";
  empty: string;
}) {
  if (items.length === 0) return <p className="text-footnote text-label-secondary py-2">{empty}</p>;
  return (
    <ul data-content="feed" className="divide-separator divide-y">
      {items.map((item) => (
        <li
          key={item.id}
          className={
            emphasis === "headline"
              ? "py-2 first:pt-0 last:pb-0"
              : "py-1 first:pt-0 last:pb-0"
          }
        >
          <Link
            href={item.href ?? storyHref(item.id)}
            className="group facet-press facet-press-subtle hover:bg-fill-4 active:bg-fill-3 focus-visible:outline-tint rounded-control duration-fast ease-out-facet -mx-2.5 flex items-start justify-between gap-3 px-2.5 py-2 transition-colors focus-visible:outline-2 pointer-coarse:min-h-11"
          >
            <span className="flex min-w-0 flex-1 items-start gap-3">
              {storyLeading(item, emphasis)}
              <span className="min-w-0 flex-1">
                <span className="text-caption text-label-secondary flex flex-wrap items-center gap-1.5 tabular-nums">
                  <span className="text-label font-medium">{item.sourceName}</span>
                  <span aria-hidden>·</span>
                  <span className="font-mono">{ageLabel(item.createdAt)}</span>
                  {emphasis === "headline" && item.kind && (
                    <Badge variant="outline" className="text-caption px-1.5 py-0 capitalize">
                      {item.kind.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  )}
                </span>
                <span
                  className={cn(
                    "text-label group-hover:text-tint mt-0.5 block transition-colors",
                    emphasis === "headline" ? "text-body font-semibold" : "text-callout"
                  )}
                >
                  {item.headline}
                </span>
                {item.body && emphasis === "headline" && (
                  <span className="text-footnote text-label-secondary mt-1 line-clamp-2 block">
                    {item.body}
                  </span>
                )}
                {item.movePct !== null && item.companyId && emphasis === "headline" && (
                  <span className="text-footnote text-label-secondary mt-1.5 inline-flex items-center gap-1.5">
                    <ChangeLabel pct={item.movePct} />
                    <span>on the news</span>
                  </span>
                )}
              </span>
            </span>
            {emphasis === "headline" && (
              <ArrowUpRight
                aria-hidden
                className="text-label-tertiary group-hover:text-tint mt-1 size-4 shrink-0 transition-colors"
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
