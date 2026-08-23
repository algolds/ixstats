import Link from "next/link";
import { City as Building2, MapPin, Group as Users, StatUp as TrendingUp, Shield, Community as Handshake } from "iconoir-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function EmbassiesArticle() {
  return (
    <ArticleLayout
      title="Embassy Network"
      description="Learn how to establish embassies abroad, manage your diplomatic staff, and leverage your embassy network for trade, influence, and intelligence."
      icon={Building2}
      prevLink={{ href: "/help/diplomacy/missions", label: "Diplomatic Missions" }}
      nextLink={{ href: "/help/mycountry/diplomacy", label: "Foreign Affairs" }}
    >
      <ContentCard>
        <Section title="What Are Embassies?">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            Embassies are your nation&apos;s permanent presence in other countries. Each embassy you
            establish strengthens your diplomatic ties, opens trade channels, and provides valuable
            intelligence about the host nation. A well-maintained embassy network is the foundation
            of any successful foreign policy.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <Handshake className="mb-2 h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h4 className="font-semibold text-slate-900 dark:text-white">Diplomatic Influence</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Embassies increase your influence with the host nation, improving relationship
                strength over time.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <TrendingUp className="mb-2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-semibold text-slate-900 dark:text-white">Trade Benefits</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Active embassies unlock trade bonuses and make economic agreements more favourable
                for your nation.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <Shield className="mb-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-slate-900 dark:text-white">Intelligence</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Embassies provide intelligence insights on the host nation, feeding into your
                Intelligence dashboard.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Where to Find Embassy Management">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            All embassy management is handled from your country&apos;s diplomacy hub:
          </p>
          <ol className="list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              Navigate to{" "}
              <Link href="/mycountry" className="text-blue-600 hover:underline dark:text-blue-400">
                MyCountry
              </Link>
              .
            </li>
            <li>
              Select the <strong>Diplomacy</strong> tab from the sidebar.
            </li>
            <li>
              Open the <strong>Embassies &amp; Relations</strong> tab to view your full embassy
              network.
            </li>
          </ol>
          <InfoBox title="Quick Tip">
            You can also access embassy actions from the Diplomacy sidebar widget on any MyCountry
            page, which shows your active embassies at a glance.
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="How to Establish a New Embassy">
          <ol className="list-decimal space-y-3 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Choose a target nation.</strong> From the Embassies &amp; Relations tab, click
              the <strong>Establish Embassy</strong> button. Browse or search for the country where
              you want diplomatic presence.
            </li>
            <li>
              <strong>Review the details.</strong> You will see the current relationship status with
              that nation, any existing diplomatic ties, and the estimated benefits of establishing
              an embassy there.
            </li>
            <li>
              <strong>Confirm and establish.</strong> Once you confirm, your embassy will be
              created. It starts at a basic level and can be upgraded over time as your relationship
              with the host nation grows.
            </li>
            <li>
              <strong>Assign staff (optional).</strong> Embassies function at a basic level
              automatically, but assigning diplomatic staff improves their effectiveness and unlocks
              additional capabilities such as hosting cultural exchanges or gathering intelligence.
            </li>
          </ol>
        </Section>

        <Section title="Managing Your Embassy Network">
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Once your embassies are established, you can manage them to maximise their value:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <Users className="mr-1 inline h-4 w-4 text-amber-600 dark:text-amber-400" />
              <strong>Staff management</strong> &mdash; Assign or reassign diplomatic personnel to
              embassies that need attention. Well-staffed embassies produce stronger results.
            </li>
            <li>
              <MapPin className="mr-1 inline h-4 w-4 text-rose-600 dark:text-rose-400" />
              <strong>Relationship tracking</strong> &mdash; Monitor the relationship strength with
              each host nation. The embassy detail view shows trends over time and any recent events
              that affected your standing.
            </li>
            <li>
              <TrendingUp className="mr-1 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <strong>Upgrade embassies</strong> &mdash; As your relationship with a host nation
              improves, you can upgrade your embassy to unlock higher-tier benefits like enhanced
              trade agreements and deeper intelligence access.
            </li>
            <li>
              <Shield className="mr-1 inline h-4 w-4 text-blue-600 dark:text-blue-400" />
              <strong>Watch for alerts</strong> &mdash; If a host nation&apos;s stability changes or
              a diplomatic incident occurs, you will receive alerts. Respond promptly to protect
              your embassy and maintain your influence.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="Embassy Benefits at a Glance">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="pb-2 text-left font-semibold text-slate-900 dark:text-white">
                    Benefit
                  </th>
                  <th className="pb-2 text-left font-semibold text-slate-900 dark:text-white">
                    How It Helps
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 font-medium">Diplomatic Influence</td>
                  <td className="py-2">
                    Gradually increases your standing with the host nation, making negotiations and
                    agreements easier.
                  </td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 font-medium">Trade Bonuses</td>
                  <td className="py-2">
                    Provides economic advantages when trading with the host nation, including better
                    terms and access to exclusive resources.
                  </td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 font-medium">Intelligence Gathering</td>
                  <td className="py-2">
                    Feeds data into your Intelligence dashboard, giving you insights on the host
                    nation&apos;s economy, stability, and diplomatic posture.
                  </td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 font-medium">Mission Support</td>
                  <td className="py-2">
                    Embassies serve as a base for diplomatic missions. Having an embassy in a
                    country improves mission success rates there.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Cultural Exchange</td>
                  <td className="py-2">
                    Upgraded embassies can host cultural exchange programmes, further strengthening
                    ties and unlocking unique achievements.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Best Practices">
          <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Pair embassy expansion with trade or cultural programmes.</strong>{" "}
              Establishing an embassy alongside a trade agreement or cultural exchange amplifies the
              benefits of both.
            </li>
            <li>
              <strong>Prioritise nations that matter to your strategy.</strong> You do not need
              embassies everywhere. Focus on key allies, trading partners, and rivals you want to
              keep an eye on.
            </li>
            <li>
              <strong>Monitor relationship alerts.</strong> When relationship strength drops, act
              quickly by reassigning staff or launching a goodwill mission to stabilise ties.
            </li>
            <li>
              <strong>Check the leaderboard.</strong> Diplomatic achievements are tracked on the
              global leaderboard. A strong embassy network contributes to your nation&apos;s overall
              ranking.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Help Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/diplomacy/missions"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Diplomatic Missions
              </Link>{" "}
              &mdash; Learn how to plan and launch missions from your embassies.
            </li>
            <li>
              <Link
                href="/help/mycountry/diplomacy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Foreign Affairs
              </Link>{" "}
              &mdash; the hub for all your diplomacy in MyCountry.
            </li>
            <li>
              <Link
                href="/help/mycountry/diplomacy"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                MyCountry Diplomacy
              </Link>{" "}
              &mdash; Full guide to the Diplomacy tab in your MyCountry dashboard.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
