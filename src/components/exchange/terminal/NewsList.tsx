"use client";

import Link from "next/link";
import { Activity, Building, Coins, Journal, StatUp } from "iconoir-react";
import type { NewsItem } from "~/lib/exchange/terminal";
import { storyHref } from "~/lib/exchange/routes";
import { cn } from "~/lib/utils";
import { ChangeLabel, ExchangeIconWell, ageLabel } from "./brand";

function storyIcon(item: NewsItem) {
  if (item.bondId || item.kind === "dividend" || item.kind === "bond") return <Coins />;
  if (item.kind === "trade" || item.movePct !== null) return <StatUp />;
  if (item.companyId) return <Building />;
  if (item.prominence === "HEADLINE") return <Journal />;
  return <Activity />;
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
        <li key={item.id} className={emphasis === "headline" ? "py-1.5 first:pt-0 last:pb-0" : "py-1 first:pt-0 last:pb-0"}>
          <Link
            href={item.href ?? storyHref(item.id)}
            className="group hover:bg-fill-4 active:bg-fill-3 focus-visible:outline-tint rounded-control duration-fast ease-out-facet -mx-2 flex items-start gap-3 px-2 py-2 transition-colors focus-visible:outline-2 pointer-coarse:min-h-11"
          >
            <ExchangeIconWell size="sm" className="mt-0.5">
              {storyIcon(item)}
            </ExchangeIconWell>
            <span className="min-w-0 flex-1">
              <span className="text-caption text-label-secondary flex items-center gap-1.5 tabular-nums">
                <span className="text-label font-medium">{item.sourceName}</span>
                <span aria-hidden>·</span>
                <span>{ageLabel(item.createdAt)}</span>
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
                <span className="text-footnote text-label-secondary mt-0.5 line-clamp-2 block">
                  {item.body}
                </span>
              )}
              {item.movePct !== null && item.companyId && emphasis === "headline" && (
                <span className="text-footnote text-label-secondary mt-1 block">
                  <ChangeLabel pct={item.movePct} /> on the news
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
