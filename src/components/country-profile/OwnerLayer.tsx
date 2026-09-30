import Link from "next/link";
import { EyeClosed, NavArrowRight } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { createUrl } from "~/lib/utils";
import type { ProfileOwnerLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";

/**
 * OwnerLayer — the one private strip on the public profile. Rendered only when the signed-in
 * viewer owns the country (`layer.owner` is null for everyone else), tinted and labelled so it
 * never reads as public record. Counts only; the work happens in MyCountry.
 */
export function OwnerLayer({
  owner,
  className,
}: {
  owner: ProfileOwnerLayer | null;
  className?: string;
}) {
  if (!owner) return null;
  const items = [
    owner.activeIssues != null && {
      label: owner.activeIssues === 1 ? "open issue" : "open issues",
      value: owner.activeIssues,
    },
    {
      label: owner.draftDirectives === 1 ? "draft directive" : "draft directives",
      value: owner.draftDirectives,
    },
    { label: "directives in force", value: owner.directivesInForce },
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <section
      aria-label="Owner view"
      className={cn(
        "bg-tint-fill border-tint/30 rounded-row flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3",
        className
      )}
    >
      <span className="text-caption text-tint inline-flex items-center gap-2">
        <EyeClosed aria-hidden className="size-3.5" />
        Only you can see this
      </span>
      <ul className="text-callout text-label flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.label} className="tabular-nums">
            <span className="text-headline">{item.value}</span>{" "}
            <span className="text-label-secondary">{item.label}</span>
          </li>
        ))}
      </ul>
      <Link
        href={createUrl("/mycountry")}
        className="text-callout text-tint focus-visible:outline-tint rounded-control-sm ml-auto inline-flex items-center gap-1 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Open MyCountry
        <NavArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
