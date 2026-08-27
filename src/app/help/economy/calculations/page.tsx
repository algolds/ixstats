import Link from "next/link";
import {
  Calculator,
  Calculator as Sigma,
  StatUp as TrendingUp,
  StatsReport as BarChart3,
  Dashboard as Gauge,
  ArrowUpRight,
} from "iconoir-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function EconomicCalculationsArticle() {
  return (
    <ArticleLayout
      title="How Your Economy Is Calculated"
      description="A plain-language guide to the formulas behind your GDP, growth rate, projections, and economic health scores."
      icon={Calculator}
      prevLink={{ href: "/help/economy/tiers", label: "Economic Tiers" }}
      nextLink={{ href: "/help/economy/modeling", label: "Modeling & Projections" }}
    >
      <ContentCard>
        {/* ── GDP: The Big Number ── */}
        <Section title="GDP: The Big Number">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Your country&apos;s <strong>Gross Domestic Product (GDP)</strong> is the single most
            important economic figure. It represents the total value of everything your nation
            produces and is calculated with a simple formula:
          </p>
          <div className="my-4 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-center dark:border-white/10 dark:bg-white/5">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              <Calculator className="mr-1 inline h-5 w-5 text-blue-500" />
              Total GDP = Population &times; GDP per Capita
            </p>
          </div>
          <p className="text-slate-700 dark:text-slate-300">
            <strong>GDP per Capita</strong> is the average economic output per person. A nation of
            50 million people with a GDP per Capita of $40,000 has a total GDP of $2 trillion.
          </p>
        </Section>

        {/* ── What Drives Growth ── */}
        <Section title="What Drives Growth">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Your GDP does not stay still. Every in-game cycle, your economy is recalculated from
            several factors:
          </p>
          <ul className="list-disc space-y-3 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <TrendingUp className="mr-1 inline h-4 w-4 text-emerald-500" />
              <strong>Base growth rate</strong> &mdash; determined by your country&apos;s{" "}
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                economic tier
              </Link>
              . Poorer nations can grow faster (up to 10%), while wealthy nations grow more slowly
              (as low as 0.5%).
            </li>
            <li>
              <strong>Global growth factor</strong> &mdash; a world-wide multiplier (currently
              3.21%) that raises or lowers everyone&apos;s growth to simulate global economic
              conditions.
            </li>
            <li>
              <strong>Local growth factor</strong> &mdash; unique to your nation, reflecting the
              quality of your government policies, tax system, and infrastructure.
            </li>
            <li>
              <strong>Storyteller events</strong> &mdash; trade agreements, natural disasters,
              economic policies, and special events created by the DM can temporarily boost or
              reduce your growth.
            </li>
            <li>
              <strong>Diminishing returns</strong> &mdash; extremely wealthy nations (those with
              very high GDP per Capita) see their growth taper off naturally, preventing runaway
              economies.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            After all modifiers are applied, your growth rate is capped by your{" "}
            <Link
              href="/help/economy/tiers"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              tier&apos;s maximum
            </Link>{" "}
            so that no single event can push growth beyond a realistic ceiling.
          </p>
        </Section>
      </ContentCard>

      <ContentCard>
        {/* ── Tier-Based Growth Caps ── */}
        <Section title="Tier-Based Growth Caps">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Your{" "}
            <Link
              href="/help/economy/tiers"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              economic tier
            </Link>{" "}
            sets a hard ceiling on how fast your GDP per Capita can climb each cycle:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="py-2 pr-4 text-left font-semibold text-slate-900 dark:text-white">
                    Tier
                  </th>
                  <th className="py-2 pr-4 text-left font-semibold text-slate-900 dark:text-white">
                    GDP per Capita
                  </th>
                  <th className="py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Max Growth
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-1.5 pr-4">Impoverished</td>
                  <td className="py-1.5 pr-4">$0 &ndash; $9,999</td>
                  <td className="py-1.5">10.0%</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-1.5 pr-4">Developing</td>
                  <td className="py-1.5 pr-4">$10,000 &ndash; $24,999</td>
                  <td className="py-1.5">7.5%</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-1.5 pr-4">Developed</td>
                  <td className="py-1.5 pr-4">$25,000 &ndash; $34,999</td>
                  <td className="py-1.5">5.0%</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-1.5 pr-4">Healthy</td>
                  <td className="py-1.5 pr-4">$35,000 &ndash; $44,999</td>
                  <td className="py-1.5">3.5%</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-1.5 pr-4">Strong</td>
                  <td className="py-1.5 pr-4">$45,000 &ndash; $54,999</td>
                  <td className="py-1.5">2.75%</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-1.5 pr-4">Very Strong</td>
                  <td className="py-1.5 pr-4">$55,000 &ndash; $64,999</td>
                  <td className="py-1.5">1.5%</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4">Extravagant</td>
                  <td className="py-1.5 pr-4">$65,000+</td>
                  <td className="py-1.5">0.5%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            This means a Developing nation can catch up quickly, but growth naturally slows as your
            economy matures. Strategic policy choices become more important at higher tiers.
          </p>
        </Section>

        {/* ── Health Scores ── */}
        <Section title="Economic Health Scores">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Beyond raw GDP, IxStats tracks several composite scores that measure different
            dimensions of your economy&apos;s health:
          </p>
          <ul className="list-disc space-y-3 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <Gauge className="mr-1 inline h-4 w-4 text-blue-500" />
              <strong>Economic Resilience Index (ERI)</strong> &mdash; how well your economy can
              absorb shocks like recessions, natural disasters, or diplomatic crises. A high ERI
              means your nation bounces back faster.
            </li>
            <li>
              <strong>Policy Impact Index (PII)</strong> &mdash; measures how effectively your
              government policies translate into real economic results. Better policy alignment
              means a higher PII.
            </li>
            <li>
              <strong>Social-Economic Welfare Index (SEWI)</strong> &mdash; captures the well-being
              of your citizens beyond just money, including factors like income equality, public
              services, and quality of life.
            </li>
            <li>
              <strong>Economic Complexity &amp; Trade Index (ECTI)</strong> &mdash; reflects how
              diversified and sophisticated your economy is. Nations that rely on a single export
              score lower than those with broad, complex economies.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            These scores are visible on your MyCountry dashboard and in the Intelligence section.
            They update automatically as your economy evolves.
          </p>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        {/* ── Projections ── */}
        <Section title="How Projections Work">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            IxStats can forecast where your economy is heading over 1-year, 5-year, and 10-year
            horizons. Projections use your current growth rate, tier, and active modifiers to
            estimate future GDP, population, and key indicators.
          </p>
          <InfoBox title="What Affects Projections">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Current growth rate</strong> &mdash; your actual rate after all modifiers,
                not just the tier maximum.
              </li>
              <li>
                <strong>Population trends</strong> &mdash; growing or shrinking population directly
                shifts your total GDP.
              </li>
              <li>
                <strong>Active events</strong> &mdash; ongoing storyteller effects (wars, trade
                deals, crises) are factored into projections.
              </li>
              <li>
                <strong>Tier transitions</strong> &mdash; if your growth is about to push you into a
                higher tier, the projection accounts for the lower growth cap you will face.
              </li>
            </ul>
          </InfoBox>
          <p className="mt-3 text-slate-700 dark:text-slate-300">
            You can explore projections in detail using the{" "}
            <Link
              href="/help/economy/modeling"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Modeling &amp; Projections
            </Link>{" "}
            tools, which let you test &ldquo;what if&rdquo; scenarios before committing to policy
            changes.
          </p>
        </Section>

        {/* ── IxTime ── */}
        <Section title="The Role of IxTime">
          <p className="text-slate-700 dark:text-slate-300">
            All economic calculations run on{" "}
            <Link
              href="/help/getting-started/ixtime"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              IxTime
            </Link>
            , the in-game clock that moves at twice the speed of real time. Growth rates,
            projections, and historical records all reference IxTime months and years rather than
            real-world dates. This means your economy evolves roughly twice as fast as you might
            expect from the raw percentage numbers.
          </p>
        </Section>

        {/* ── Where to Check ── */}
        <Section title="Where to Check Your Numbers">
          <InfoBox title="Quick Reference">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <BarChart3 className="mr-1 inline h-4 w-4" />
                <strong>MyCountry Overview</strong> &mdash; shows your GDP, growth rate, and tier at
                a glance in the economic summary card.
              </li>
              <li>
                <strong>Intelligence &gt; Economic tab</strong> &mdash; deep-dive charts for GDP
                history, sector breakdown, and trend analysis.
              </li>
              <li>
                <strong>Modeling page</strong> &mdash; run projections and compare scenarios.
                Accessible from your country profile or the MyCountry sidebar.
              </li>
              <li>
                <strong>Leaderboards</strong> &mdash; see how your GDP, growth, and health scores
                rank against other nations.
              </li>
              <li>
                <strong>Country profile</strong> &mdash; any nation&apos;s public profile displays
                its current economic data and tier.
              </li>
            </ul>
          </InfoBox>
        </Section>

        {/* ── Tips ── */}
        <WarningBox title="Tips for Healthy Growth">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Sigma className="inline h-4 w-4" /> Diversify your economy. Nations with a broad
              range of sectors score higher on the ECTI and recover faster from shocks.
            </li>
            <li>
              <ArrowUpRight className="inline h-4 w-4" /> Keep an eye on projections after making
              policy or tax changes &mdash; small adjustments compound quickly under IxTime.
            </li>
            <li>
              Review your{" "}
              <Link
                href="/help/economy/tax-system"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                tax system
              </Link>{" "}
              regularly. Tax revenue feeds directly into government spending capacity and debt
              management, both of which influence your growth rate.
            </li>
          </ul>
        </WarningBox>

        {/* ── Related Pages ── */}
        <Section title="Related Help Pages">
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <Link
                href="/help/economy/tiers"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economic Tier System
              </Link>{" "}
              &mdash; how tiers are assigned and why they matter for growth and achievements.
            </li>
            <li>
              <Link
                href="/help/economy/modeling"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Modeling &amp; Projections
              </Link>{" "}
              &mdash; simulate scenarios and forecast your economy&apos;s future.
            </li>
            <li>
              <Link
                href="/help/economy/tax-system"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Tax System
              </Link>{" "}
              &mdash; configure taxes, brackets, and exemptions that shape your revenue.
            </li>
            <li>
              <Link
                href="/help/economy/trade"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Trade &amp; Commerce
              </Link>{" "}
              &mdash; how international trade affects your GDP and ECTI score.
            </li>
            <li>
              <Link
                href="/help/getting-started/ixtime"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Understanding IxTime
              </Link>{" "}
              &mdash; the in-game clock that drives all economic cycles.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
