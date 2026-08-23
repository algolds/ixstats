import { Dashboard as LayoutDashboard, Activity, StatsReport as BarChart3, Archery as Target } from "iconoir-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryOverviewArticle() {
  return (
    <ArticleLayout
      title="Your National Overview"
      description="Your nation's health at a glance — the vital signs you check first each visit."
      icon={LayoutDashboard}
    >
      <ContentCard>
        <Section title="The First Thing You'll See">
          <p>
            The Overview is your nation&rsquo;s home screen — a calm, at-a-glance read on how your
            country is doing across the board. No decisions to make here; this is where you take the
            temperature. The doing happens in the other MyCountry sections.
          </p>
        </Section>

        <Section title="The Vital Signs">
          <p>Four rings up top give your nation a quick health score in each area:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Economy</strong> — growth, debt, trade, and how varied your economy is, rolled
              into one number.
            </li>
            <li>
              <strong>Society</strong> — how your people are doing: population, education, health,
              and everyday satisfaction.
            </li>
            <li>
              <strong>Diplomacy</strong> — your standing in the world: embassies, relationships, and
              alliances.
            </li>
            <li>
              <strong>Defense</strong> — how ready and secure your nation is, at home and abroad.
            </li>
          </ul>
          <p className="mt-2">
            Green is healthy, amber is worth a look, red wants your attention. A glance tells you
            where to spend your time.
          </p>
        </Section>

        <Section title="Tap Any Number for the Story Behind It">
          <InfoBox title="Drill into the details">
            <p>
              The key figures — GDP, population, growth, debt and more — are all tappable. Open one
              and you&rsquo;ll get the full picture:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Overview</strong> — where the number stands now, and what&rsquo;s driving
                it.
              </li>
              <li>
                <strong>Trends</strong> — how it&rsquo;s moved over time.
              </li>
              <li>
                <strong>Comparison</strong> — how you stack up against other nations.
              </li>
              <li>
                <strong>Details</strong> — the pieces that add up to the total.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Where Your Economy Goes">
          <p>
            Below the key figures, a breakdown shows how your economy splits across its sectors, and
            where your government spends — education, healthcare, defense, infrastructure, and the
            rest. It&rsquo;s the quickest way to see what kind of nation you&rsquo;re actually
            running.
          </p>
        </Section>

        <Section title="Handy on the Side">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Activity className="inline h-4 w-4 text-amber-500" /> <strong>Issues waiting</strong>{" "}
              — a heads-up when decisions are piling up. Tap through to the{" "}
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive desk
              </Link>{" "}
              to handle them.
            </li>
            <li>
              <BarChart3 className="inline h-4 w-4 text-cyan-500" /> <strong>Your Vault</strong> — a
              quick peek at your IxCredits and Vault level.
            </li>
            <li>
              <Target className="inline h-4 w-4 text-purple-500" /> <strong>Quick actions</strong> —
              shortcuts to the things you do most.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The Executive Desk
              </Link>{" "}
              — where the big decisions get made.
            </li>
            <li>
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economic Tiers
              </Link>{" "}
              — how your economy climbs from one stage to the next.
            </li>
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits
              </Link>{" "}
              — earning and spending the currency.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
