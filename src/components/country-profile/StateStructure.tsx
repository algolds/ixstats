import Link from "next/link";
import { Building, Crown, NavArrowRight, Shield } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";
import type { BranchKey, StateBranch } from "./derive";

const ICON: Record<BranchKey, typeof Crown> = {
  executive: Crown,
  legislative: Building,
  judicial: Shield,
};

/**
 * StateStructure — the state structure on the real record: one column per branch (executive, legislative, judicial) with its offices and bodies, the
 * system as a badge, the ministries, and a link to the wiki's government chapter when there is
 * one. Branches without a record are left out; nothing renders without any.
 */
export function StateStructure({
  branches,
  system,
  ministries,
  wikiSource,
  className,
}: {
  branches: readonly StateBranch[];
  system: string | null;
  ministries: readonly string[];
  /** The wiki chapter on the government, when the article has one. */
  wikiSource?: { heading: string; href: string } | null;
  className?: string;
}) {
  if (branches.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {system && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-subhead text-label-secondary">System</span>
          <Badge variant="secondary">{system}</Badge>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {branches.map((branch) => {
          const Icon = ICON[branch.key];
          return (
            <li
              key={branch.key}
              className="bg-surface-secondary rounded-row flex flex-col gap-3 p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="bg-fill-4 text-label-secondary rounded-control-sm flex size-8 shrink-0 items-center justify-center"
                >
                  <Icon className="size-4" />
                </span>
                <h3 className="text-headline text-label">{branch.title}</h3>
              </div>
              <dl className="flex flex-col gap-2">
                {branch.rows.map((row) => (
                  <div key={`${row.role}-${row.name}`} className="min-w-0">
                    <dt className="text-footnote text-label-secondary">{row.role}</dt>
                    <dd className="text-body text-label break-words">{row.name}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      {ministries.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-subhead text-label-secondary">Ministries</span>
          <ul className="flex flex-wrap gap-2">
            {ministries.map((m) => (
              <li key={m}>
                <Badge variant="default">{m}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {wikiSource && (
        <Link
          href={createUrl(wikiSource.href)}
          className="text-callout text-tint focus-visible:outline-tint rounded-control-sm inline-flex w-fit items-center gap-1 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Read “{wikiSource.heading}” on the wiki
          <NavArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}
