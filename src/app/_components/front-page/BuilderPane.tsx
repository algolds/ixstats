"use client";

import Link from "next/link";
import { NavArrowRight, PageEdit } from "iconoir-react";
import { IIWikiLogo } from "~/components/cards/display/IIWikiLogo";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { HelpIcon } from "~/components/ui/help-icon";
import { MonogramBackdrop } from "./Pane";

const BUILDER_PATHS = [
  {
    href: "/builder?import=1",
    icon: "iiwiki",
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
 * Primary MyCountry Builder card in the right rail, a Lens over the MyCountry monogram in gold:
 * recessed emblem + title + help tooltip, a full-width gold Start CTA, then borderless quick-start rows.
 */
export function BuilderPane() {
  return (
    <MonogramBackdrop app="mycountry">
      <Card padding="md">
        <div className="flex min-w-0 items-center gap-3">
          <span className="facet-recess rounded-control flex size-12 shrink-0 items-center justify-center">
            <MyCountryLogo size="sm" variant="icon-only" animated={false} />
          </span>
          <div className="min-w-0">
            <h2 className="text-title-3 text-label inline-flex items-center gap-1.5">
              <span>Create a country</span>
              <HelpIcon
                title="MyCountry Builder"
                content="Build a country using real-world and historical templates, import an existing country from iiwiki, or create one from scratch."
                side="top"
              />
            </h2>
            <p className="text-subhead text-label-secondary mt-0.5">
              Build your own country and join a realm
            </p>
          </div>
        </div>

        <Button asChild size="lg" className="mt-4 w-full">
          <Link href="/builder">
            <span>Start building</span>
            <NavArrowRight aria-hidden />
          </Link>
        </Button>

        <ul data-content="feed" className="border-separator mt-3 border-t pt-1">
          {BUILDER_PATHS.map(({ href, icon: Icon, title, subtitle }) => (
            <li key={href} className="py-1">
              <Link
                href={href}
                className="facet-press facet-press-subtle hover:bg-fill-4 focus-visible:outline-tint rounded-control group flex items-center justify-between gap-2.5 px-2 py-1.5 focus-visible:outline-2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="facet-recess text-tint rounded-control-sm grid size-7 shrink-0 place-items-center"
                  >
                    {Icon === "iiwiki" ? (
                      <IIWikiLogo className="size-4" />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
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
                  className="text-label-tertiary group-hover:text-tint duration-fast size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </MonogramBackdrop>
  );
}
