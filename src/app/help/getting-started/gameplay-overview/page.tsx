import Link from "next/link";
import { Gamepad2, Rocket, TrendingUp, Trophy } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function GameplayOverviewArticle() {
  return (
    <ArticleLayout
      title="How It All Fits Together"
      description="Economy, government, diplomacy, the map — a quick tour of how your nation comes alive."
      icon={Gamepad2}
      prevLink={{ href: "/help/getting-started/first-country", label: "Create Your First Nation" }}
      nextLink={{ href: "/help/getting-started/ixtime", label: "The World Clock (IxTime)" }}
    >
      <ContentCard>
        <Section title="The Rhythm of Play">
          <p>
            There&rsquo;s no single &ldquo;win&rdquo; here — IxStats is about building a nation and
            living with it over time. Most of what you do falls into a simple rhythm:
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>
              <Rocket className="inline h-4 w-4 text-blue-500" /> <strong>Create</strong> your
              nation in the{" "}
              <Link href="/builder" className="text-blue-600 hover:underline dark:text-blue-400">
                builder
              </Link>{" "}
              — its government, economy, and people.
            </li>
            <li>
              <strong>Shape</strong> it — tune policies and{" "}
              <Link
                href="/help/government/synergy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                combine choices
              </Link>{" "}
              that make your nation stronger and more like the place you imagined.
            </li>
            <li>
              <strong>Decide</strong> — answer{" "}
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                national issues
              </Link>
              , weather crises, and take{" "}
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                big actions
              </Link>{" "}
              like stimulus or infrastructure. Every choice leaves a mark on your economy and your
              story.
            </li>
            <li>
              <TrendingUp className="inline h-4 w-4 text-emerald-500" /> <strong>Grow</strong> —
              watch your economy climb{" "}
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                tiers
              </Link>
              , rise up the{" "}
              <Link
                href="/leaderboards"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                leaderboards
              </Link>
              , and unlock{" "}
              <Link
                href="/help/gameplay/achievements"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                achievements
              </Link>
              .
            </li>
            <li>
              <strong>Connect</strong> — open{" "}
              <Link
                href="/help/mycountry/diplomacy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                diplomacy
              </Link>{" "}
              with other nations and meet their players in the{" "}
              <Link
                href="/help/social/thinkpages"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                community
              </Link>
              .
            </li>
          </ol>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="The Systems Behind Your Nation">
          <InfoBox title="Six things you steer">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Economy</strong> — GDP, trade, jobs, and tax revenue, all modeled and live.{" "}
                <Link
                  href="/help/economy/modeling"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </Link>
              </li>
              <li>
                <strong>Government</strong> — how your nation is run, and how your choices ripple
                through everything else.{" "}
                <Link
                  href="/help/government/atomic"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </Link>
              </li>
              <li>
                <strong>Diplomacy</strong> — embassies, missions, and the give-and-take with other
                nations and their leaders.{" "}
                <Link
                  href="/help/diplomacy/embassies"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </Link>
              </li>
              <li>
                <strong>Defense</strong> — your military, a deep equipment catalog, and how you keep
                your nation secure.{" "}
                <Link
                  href="/help/defense/overview"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </Link>
              </li>
              <li>
                <strong>Intelligence</strong> — the dashboards and forecasts that turn your numbers
                into clear next moves.{" "}
                <Link
                  href="/help/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </Link>
              </li>
              <li>
                <strong>Politics</strong> — your legislature, parties, and the elections that decide
                who holds power.{" "}
                <Link
                  href="/help/mycountry/politics"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </Link>
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Rewards as You Play">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Trophy className="inline h-4 w-4 text-amber-500" /> <strong>Achievements</strong> —
              milestones across five rarity tiers, each worth{" "}
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits
              </Link>
              .{" "}
              <Link
                href="/help/gameplay/achievements"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                See them all
              </Link>
            </li>
            <li>
              <strong>IxCredits</strong> — earned through play, spent on{" "}
              <Link
                href="/help/vault/card-packs"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                packs
              </Link>
              , trades, and cosmetics.
            </li>
            <li>
              <strong>Your Vault</strong> — levels up as you go, unlocking more along the way.{" "}
              <Link
                href="/help/vault/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Visit your Vault
              </Link>
            </li>
            <li>
              <strong>Leaderboards</strong> — see how your nation stacks up by economy, population,
              and influence.{" "}
              <Link
                href="/help/gameplay/leaderboards"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                View rankings
              </Link>
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="A Good First Path">
          <InfoBox title="If you're not sure where to go next">
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Build your nation with{" "}
                <Link
                  href="/help/getting-started/first-country"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Create Your First Nation
                </Link>
                .
              </li>
              <li>
                Get to know your home base in the{" "}
                <Link
                  href="/help/mycountry/overview"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  MyCountry overview
                </Link>
                .
              </li>
              <li>
                Answer your first{" "}
                <Link
                  href="/help/gameplay/national-issues"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  national issue
                </Link>{" "}
                and see the consequences play out.
              </li>
              <li>
                Open your first{" "}
                <Link
                  href="/help/diplomacy/embassies"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  embassy
                </Link>{" "}
                and start building relationships.
              </li>
              <li>
                Pop into your{" "}
                <Link
                  href="/help/vault/overview"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Vault
                </Link>{" "}
                and open a pack.
              </li>
            </ol>
          </InfoBox>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/gameplay/simulation"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                How Your Nation Comes Alive
              </Link>{" "}
              — the living world and its rhythms.
            </li>
            <li>
              <Link
                href="/help/getting-started/ixtime"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The World Clock (IxTime)
              </Link>{" "}
              — why time moves the way it does here.
            </li>
            <li>
              <Link
                href="/help/mycountry/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Your National Overview
              </Link>{" "}
              — the vitals you&rsquo;ll check first each visit.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
