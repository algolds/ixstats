"use client";

import Link from "next/link";
import type { NewsItem } from "~/lib/exchange/terminal";
import { storyHref } from "~/lib/exchange/routes";
import { cn } from "~/lib/utils";
import { ChangeLabel, ageLabel } from "./brand";

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
  if (items.length === 0) return <p className="text-footnote text-label-secondary">{empty}</p>;
  return (
    <ul className="divide-separator divide-y">
      {items.map((item) => (
        <li key={item.id} className={emphasis === "headline" ? "py-3" : "py-2"}>
          <Link href={item.href ?? storyHref(item.id)} className="group block">
            <span className="text-caption text-label-secondary">
              {item.sourceName} · {ageLabel(item.createdAt)}
            </span>
            <span
              className={cn(
                "text-label group-hover:text-tint block",
                emphasis === "headline" ? "text-body font-semibold" : "text-footnote"
              )}
            >
              {item.headline}
            </span>
            {item.movePct !== null && item.companyId && emphasis === "headline" && (
              <span className="text-footnote text-label-secondary">
                <ChangeLabel pct={item.movePct} /> on the news
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
