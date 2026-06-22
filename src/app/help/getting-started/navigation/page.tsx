"use client";

import Link from "next/link";
import { Navigation, LayoutDashboard, Menu } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function NavigationArticle() {
  return (
    <ArticleLayout
      title="Finding Your Way Around"
      description="Where everything lives, plus a few shortcuts to get around fast."
      icon={Navigation}
      prevLink={{ href: "/help/getting-started/ixtime", label: "The World Clock (IxTime)" }}
      nextLink={{ href: "/help/mycountry/overview", label: "Your National Overview" }}
    >
      <ContentCard>
        <Section title="The Top Menu">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>The top bar</strong> is your home row. Once you&rsquo;re signed in, it gets you
              to{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>
              , the{" "}
              <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                Country Builder
              </Link>
              , your{" "}
              <Link href="/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
                dashboards
              </Link>
              , the{" "}
              <Link href="/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
                community
              </Link>
              , and this{" "}
              <Link href="/help" className="text-blue-600 hover:underline dark:text-blue-400">
                Help Center
              </Link>
              . The menu adjusts to who you are and what you can do.
            </li>
            <li>
              <strong>The MyCountry menu</strong> jumps you straight into any part of your nation —
              Overview, Executive, Diplomacy, Intelligence, Defense, Politics, and the Map Editor.
            </li>
            <li>
              <strong>Your home page</strong> gathers quick links, alerts, and live cards so you can
              pick right back up where you left off.
            </li>
          </ul>
        </Section>

        <Section title="Shortcuts Worth Knowing">
          <InfoBox title="Get around faster">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Search anything, instantly.</strong> Press{" "}
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">
                  Ctrl
                </kbd>{" "}
                +{" "}
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">
                  K
                </kbd>{" "}
                (or{" "}
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">
                  Cmd
                </kbd>{" "}
                +{" "}
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">
                  K
                </kbd>{" "}
                on a Mac) to open the command palette and jump anywhere on the platform.
              </li>
              <li>
                Inside MyCountry, use the sidebar to move between sections like{" "}
                <Link
                  href="/help/mycountry/overview"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Overview
                </Link>
                ,{" "}
                <Link
                  href="/help/mycountry/executive"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Executive
                </Link>
                ,{" "}
                <Link
                  href="/help/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Intelligence
                </Link>
                ,{" "}
                <Link
                  href="/help/mycountry/diplomacy"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Diplomacy
                </Link>
                , and{" "}
                <Link
                  href="/help/mycountry/defense"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Defense
                </Link>
                .
              </li>
              <li>
                Helpful nudges and alerts can appear anywhere in MyCountry when something needs your
                attention — a decision to make, or an opportunity worth a look.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Light & Dark">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Switch between light and dark from your profile menu in the top-right corner.
            </li>
            <li>Your choice is remembered, so it stays the way you like it every visit.</li>
            <li>
              Different areas have their own signature colors — gold for{" "}
              <Link
                href="/help/mycountry/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry
              </Link>
              , blue for the wider world — and they look great in both modes.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <LayoutDashboard className="inline h-4 w-4" />{" "}
              <Link
                href="/help/mycountry/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Your National Overview
              </Link>{" "}
              — the heart of your nation, and where most visits begin.
            </li>
            <li>
              <Menu className="inline h-4 w-4" />{" "}
              <Link
                href="/help/getting-started/first-country"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Create Your First Nation
              </Link>{" "}
              — ready to build? Start here.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
