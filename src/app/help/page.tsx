import React from "react";
import Link from "next/link";
import { type Metadata } from "next";
import { Archery as Target, Crown, Coins, Globe, NavArrowRight } from "iconoir-react";
import { HelpExplorer } from "./_components/HelpExplorer";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";

export const metadata: Metadata = {
  title: "Help Center - IxStats",
  description:
    "Guides to every part of IxStats: building a nation, MyCountry, the Vault, maps, the wiki and the community.",
};

const QUICK_LINKS = [
  {
    href: "/help/getting-started/welcome",
    icon: Target,
    title: "New to IxStats?",
    caption: "Start here",
  },
  {
    href: "/help/getting-started/first-country",
    icon: Crown,
    title: "Build a nation",
    caption: "Your first country",
  },
  {
    href: "/help/mycountry/overview",
    icon: Globe,
    title: "Run your nation",
    caption: "MyCountry overview",
  },
  {
    href: "/help/vault/ixcredits",
    icon: Coins,
    title: "IxCredits",
    caption: "Earning & the daily reward",
  },
] as const;

const INTRO = (
  <>
    Plain guides to every part of IxStats. Search below or pick a topic. New here? Start with{" "}
    <Link
      href="/help/getting-started/welcome"
      className="text-primary font-medium underline-offset-4 hover:underline"
    >
      Welcome to IxStats
    </Link>
    .
  </>
);

export default function HelpPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl px-2 pt-2 sm:px-4 lg:px-6">
        <PageHeader title="Help center" subtitle={INTRO} />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Interactive Explorer */}
        <HelpExplorer />

        {/* Quick Links Footer */}
        <nav aria-label="Quick links" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, icon: Icon, title, caption }) => (
            <Link
              key={href}
              href={href}
              data-cuelume-press="tick"
              data-cuelume-hover="tick"
              className="group focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="group-hover:border-foreground/20 flex min-h-11 items-center gap-3 rounded-xl p-4 transition-[border-color,transform] duration-150 group-active:scale-[0.99]">
                <Icon aria-hidden="true" className="text-muted-foreground h-6 w-6 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-sm font-semibold">{title}</div>
                  <div className="text-muted-foreground text-xs">{caption}</div>
                </div>
                <NavArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                />
              </Card>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
