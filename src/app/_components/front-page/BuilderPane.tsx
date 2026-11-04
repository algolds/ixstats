"use client";

import Link from "next/link";
import { Building, Crown, Import, NavArrowRight, PageEdit, StatsReport } from "iconoir-react";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { HelpIcon } from "~/components/ui/help-icon";

const FOUNDING_PILLARS = [
  { icon: Crown, label: "Identity" },
  { icon: Building, label: "Government" },
  { icon: StatsReport, label: "Economy" },
] as const;

const BUILDER_PATHS = [
  {
    href: "/builder?import=1",
    icon: Import,
    title: "Import from IIWiki",
    subtitle: "Prefill from an existing wiki page",
  },
  {
    href: "/builder?step=identity",
    icon: PageEdit,
    title: "Create from scratch",
    subtitle: "Customize all aspects of your country",
  },
] as const;

/**
 * Primary MyCountry Builder card in the right rail scoped to `data-app="mycountry"` gold:
 * recessed emblem + title + help tooltip + primary gold Start CTA, a 3-pillar founding
 * well strip, and borderless quick-start rows.
 */
export function BuilderPane() {
  return (
    <div data-app="mycountry" className="contents">
      <Card padding="md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="facet-recess rounded-control flex size-10 shrink-0 items-center justify-center">
              <MyCountryLogo size="sm" variant="icon-only" animated={false} />
            </span>
            <div className="min-w-0">
              <h2 className="text-headline text-label inline-flex items-center gap-1.5">
                <span>Create a country</span>
                <HelpIcon
                  title="MyCountry Builder"
                  content="Build a country using real-world and historical templates, import an existing country from iiwiki, or create one from scratch."
                  side="top"
                />
              </h2>
              <p className="text-footnote text-label-secondary mt-0.5">
                Build your own country and join a realm
              </p>
            </div>
          </div>

          <Button asChild size="sm" className="shrink-0 rounded-full">
            <Link href="/builder">
              <span>Start</span>
              <NavArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="facet-well divide-separator rounded-control mt-3 grid grid-cols-3 divide-x py-2">
          {FOUNDING_PILLARS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="text-caption text-label-secondary flex min-w-0 items-center justify-center gap-1.5 px-2 font-medium"
            >
              <Icon aria-hidden className="text-tint size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>

        <ul data-content="feed" className="border-separator mt-3 border-t pt-1">
          {BUILDER_PATHS.map(({ href, icon: Icon, title, subtitle }) => (
            <li key={href} className="py-1">
              <Link
                href={href}
                className="facet-press facet-press-subtle hover:bg-fill-4 focus-visible:outline-tint rounded-control group flex items-center justify-between gap-2.5 px-2 py-1.5 focus-visible:outline-2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="facet-recess text-tint rounded-control-sm grid size-7 shrink-0 place-items-center">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-callout text-label block font-medium group-hover:underline">
                      {title}
                    </span>
                    <span className="text-caption text-label-secondary block truncate">
                      {subtitle}
                    </span>
                  </span>
                </span>
                <NavArrowRight
                  aria-hidden
                  className="text-label-tertiary group-hover:text-tint size-4 shrink-0 transition-transform duration-fast group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
