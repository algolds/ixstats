import Link from "next/link";
import { StatUp as TrendingUp, StatsReport as BarChart3, Dashboard as Gauge } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function EconomicTiersArticle() {
  const linkClass = "text-blue-600 hover:underline dark:text-blue-400";

  return (
    <ArticleLayout
      title="Economic Tiers"
      description="What tier your nation sits in, how it's decided, and how to climb to the next one."
      icon={TrendingUp}
      prevLink={{ href: "/help/economy/calculations", label: "How Your Economy Is Measured" }}
      nextLink={{ href: "/help/economy/modeling", label: "Planning Ahead" }}
    >
      <ContentCard>
        <Section title="What Tiers Are">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            Every nation sits in an economic tier — a simple way of saying how wealthy and developed
            it is. Your tier shapes what you can unlock, who you&rsquo;re ranked against, and how
            fast your economy can grow. Think of it as your nation&rsquo;s weight class.
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            There are seven, measured by your <strong>GDP per person</strong>, from humblest to
            grandest:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Impoverished</strong> (up to $10k per person) — just getting started, with the
              most room to grow.
            </li>
            <li>
              <strong>Developing</strong> ($10k–$25k) — the foundations of a modern economy are
              going in.
            </li>
            <li>
              <strong>Developed</strong> ($25k–$35k) — a growing middle class and real industry;
              trade starts to matter.
            </li>
            <li>
              <strong>Healthy</strong> ($35k–$45k) — stable and varied, with a comfortable standard
              of living.
            </li>
            <li>
              <strong>Strong</strong> ($45k–$55k) — a regional power with well-funded public
              services.
            </li>
            <li>
              <strong>Very Strong</strong> ($55k–$65k) — among the wealthiest nations, with real
              global pull.
            </li>
            <li>
              <strong>Extravagant</strong> ($65k+) — the summit. Only the most successful nations
              get here.
            </li>
          </ol>
        </Section>

        <Section title="How Your Tier Is Decided">
          <p className="mb-4 text-slate-700 dark:text-slate-300">Two things set your tier:</p>
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>GDP per person</strong> — your total output shared across your population.
              This is the main driver: the higher it climbs, the higher your tier.
            </li>
            <li>
              <strong>Population</strong> — big nations have a harder time keeping per-person output
              high, so size is taken into account. A tiny city-state and a sprawling empire are
              judged fairly.
            </li>
          </ul>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Your tier updates on its own as your economy moves. Curious about the math?{" "}
            <Link href="/help/economy/calculations" className={linkClass}>
              How Your Economy Is Measured
            </Link>{" "}
            has the details.
          </p>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="How to Climb">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            Moving up the tiers is one of the great long games here. A few ways to do it:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Grow your economy</strong> — invest in productive sectors, set smart taxes,
              and trade. Test ideas first with the{" "}
              <Link href="/help/economy/modeling" className={linkClass}>
                planning tools
              </Link>
              .
            </li>
            <li>
              <strong>Mind your population</strong> — growing too fast can thin out your per-person
              wealth. Balance growth with prosperity.
            </li>
            <li>
              <strong>Spend wisely</strong> — money put into education, infrastructure, and
              technology pays off down the road.
            </li>
            <li>
              <strong>Keep things stable</strong> — political turmoil and low approval drag your
              economy down. A steady hand helps.
            </li>
            <li>
              <strong>Make friends</strong> — trade deals and alliances with prosperous nations can
              give your economy a lift.
            </li>
          </ul>
        </Section>

        <Section title="Why Climbing Is Worth It">
          <InfoBox title="What higher tiers bring">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Achievements</strong> — many{" "}
                <Link href="/help/gameplay/achievements" className={linkClass}>
                  achievements
                </Link>{" "}
                ask you to reach a certain tier.
              </li>
              <li>
                <strong>Fair rankings</strong> — the{" "}
                <Link href="/help/gameplay/leaderboards" className={linkClass}>
                  leaderboards
                </Link>{" "}
                let you compare yourself with nations at your level.
              </li>
              <li>
                <strong>Resilience</strong> — wealthier nations shrug off shocks and downturns more
                easily.
              </li>
              <li>
                <strong>Bragging rights</strong> — your tier shows on your public profile and posts,
                so the world can see how far you&rsquo;ve come.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Where to Check Your Tier">
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Your National Overview</strong> — your tier sits right alongside your key
              numbers.
            </li>
            <li>
              <strong>Intelligence</strong> — see how close you are to the next tier and how
              you&rsquo;re trending.
            </li>
            <li>
              <Link href="/leaderboards" className={linkClass}>
                Leaderboards
              </Link>{" "}
              — filter by tier to find your true peers.
            </li>
          </ul>
        </Section>

        <InfoBox title="Quick Tips">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <BarChart3 className="inline h-4 w-4" /> Check Intelligence now and then to catch
              trends before they become problems.
            </li>
            <li>
              <Gauge className="inline h-4 w-4" /> If your tier slips, revisit your spending and
              taxes — small tweaks add up fast.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
