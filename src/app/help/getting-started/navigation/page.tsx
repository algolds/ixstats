"use client";

import Link from "next/link";
import { Navigation, LayoutDashboard, Menu } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function NavigationArticle() {
  return (
    <ArticleLayout
      title="Finding Your Way Around"
      description="Everything you need to know about menus, shortcuts, and getting where you want to go fast."
      icon={Navigation}
      prevLink={{ href: "/help/getting-started/welcome", label: "Welcome" }}
      nextLink={{ href: "/help/getting-started/first-country", label: "Creating Your First Country" }}
    >
      <ContentCard>
        <Section title="The Main Menu">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Top Navigation Bar:</strong> Once you&rsquo;re signed in, the top bar gives you
              quick access to{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>,{" "}
              <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                Country Builder
              </Link>,{" "}
              <Link href="/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
                Dashboards
              </Link>,{" "}
              <Link href="/thinkpages" className="text-blue-600 hover:underline dark:text-blue-400">
                ThinkPages
              </Link>, and{" "}
              <Link href="/help" className="text-blue-600 hover:underline dark:text-blue-400">
                Help
              </Link>. The menu adapts based on whether you&rsquo;re signed in and what permissions you have.
            </li>
            <li>
              <strong>MyCountry Dropdown:</strong> Hover over{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>{" "}
              in the navigation to jump straight into any of your seven sections: Overview, Executive,
              Diplomacy, Intelligence, Defense, Politics, and Map Editor.
            </li>
            <li>
              <strong>Home Page:</strong> Your signed-in home page surfaces quick links, alerts, and
              dynamic cards so you can jump back into whatever you were working on.
            </li>
            <li>
              <strong>Help Center:</strong> The{" "}
              <Link href="/help" className="text-blue-600 hover:underline dark:text-blue-400">
                Help Center
              </Link>{" "}
              is always available from the top menu, with articles covering every platform feature.
            </li>
          </ul>
        </Section>

        <Section title="Quick Actions & Shortcuts">
          <InfoBox title="Inside MyCountry">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Use the MyCountry dropdown or sidebar to navigate between sections like{" "}
                <Link href="/help/mycountry/overview" className="text-blue-600 hover:underline dark:text-blue-400">
                  National Overview
                </Link>,{" "}
                <Link href="/help/mycountry/executive" className="text-blue-600 hover:underline dark:text-blue-400">
                  Executive Command
                </Link>,{" "}
                <Link href="/help/mycountry/intelligence" className="text-blue-600 hover:underline dark:text-blue-400">
                  Intelligence
                </Link>,{" "}
                <Link href="/help/mycountry/diplomacy" className="text-blue-600 hover:underline dark:text-blue-400">
                  Diplomacy
                </Link>, and{" "}
                <Link href="/help/mycountry/defense" className="text-blue-600 hover:underline dark:text-blue-400">
                  Defense
                </Link>.
              </li>
              <li>
                Each section has its own tabs and content. For example, the Executive section includes
                meetings, policies, and national issues, while Intelligence offers dashboards,
                analysis, and reports.
              </li>
              <li>Compliance alerts can appear anywhere in MyCountry to keep you informed of urgent tasks.</li>
              <li>
                <strong>Command Palette:</strong> Press <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">Ctrl</kbd> + <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">K</kbd> (or <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">Cmd</kbd> + <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">K</kbd> on Mac)
                to open the command palette for quick searches and navigation across the entire platform.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Dark Mode & Appearance">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Toggle between light and dark themes from your profile menu in the top-right corner of the screen.
            </li>
            <li>
              Your preference is saved automatically, so it persists every time you visit.
            </li>
            <li>
              Some views, like the{" "}
              <Link href="/help/mycountry/overview" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry dashboard
              </Link>, use custom color themes (gold for MyCountry, blue for Global, and more) that
              work beautifully in both modes.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <LayoutDashboard className="inline h-4 w-4" />{" "}
              <Link href="/help/technical/architecture" className="text-blue-600 hover:underline dark:text-blue-400">
                Platform Architecture
              </Link>{" "}
              -- a deeper look at how everything fits together.
            </li>
            <li>
              <Menu className="inline h-4 w-4" />{" "}
              <Link href="/help/getting-started/first-country" className="text-blue-600 hover:underline dark:text-blue-400">
                Creating Your First Country
              </Link>{" "}
              -- ready to build? Start here.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
