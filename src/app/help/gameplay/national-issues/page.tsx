import Link from "next/link";
import { Bell, AlertTriangle, CheckCircle, Cog } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function NationalIssuesArticle() {
  return (
    <ArticleLayout
      title="National Issues &amp; Decisions"
      description="Events that land on your desk and ask what kind of leader you are — and your choices stick."
      icon={Bell}
    >
      <ContentCard>
        <Section title="What Are National Issues?">
          <p>
            National Issues are events that grow out of what&apos;s actually happening in your
            nation. If you&apos;ve answered issues on NationStates, you&apos;ll recognize the spirit
            &mdash; but here your choices ripple straight into your economy, society, diplomacy, and
            defense. Up to three fresh issues turn up at a time.
          </p>
          <p className="mt-3">
            You&apos;ll find them in your{" "}
            <Link
              href="/help/mycountry/executive"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Executive
            </Link>{" "}
            inbox, ready whenever you open it.
          </p>
        </Section>

        <Section title="Where Issues Come From">
          <InfoBox title="Always about your nation, right now">
            <p>
              <Cog className="inline h-4 w-4" /> Issues are never random. When you open your inbox,
              the game takes a fresh look at your nation and surfaces the situations that fit:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                It reads your nation as it stands — your economy, politics, and relationships.
              </li>
              <li>It finds the events that genuinely make sense for where you are right now.</li>
              <li>
                The leaders of other nations — and their personalities — shape which ones land on
                your desk.
              </li>
              <li>
                You get the few that matter most, written with your own nation&apos;s details.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Responding to Issues">
          <p>Each issue presents multiple response options. Each choice has consequences:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <CheckCircle className="inline h-4 w-4 text-emerald-500" />{" "}
              <strong>Economic Effects:</strong> Changes to GDP growth, tax revenue, trade balance,
              or sector performance
            </li>
            <li>
              <strong>Social Effects:</strong> Impact on population satisfaction, stability,
              healthcare, or education metrics
            </li>
            <li>
              <strong>Diplomatic Effects:</strong> Changes to relationship strength, international
              reputation, or alliance status
            </li>
            <li>
              <strong>Defense Effects:</strong> Impact on military readiness, security assessment,
              or equipment condition
            </li>
          </ul>
        </Section>

        <Section title="Urgency & Auto-Resolution">
          <p>
            <AlertTriangle className="inline h-4 w-4 text-amber-500" /> Issues come with urgency
            levels that affect their visual appearance and handling:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Higher urgency issues are displayed prominently with warning colors</li>
            <li>
              Some issues have deadlines — if not addressed, they auto-resolve with default (usually
              unfavorable) outcomes
            </li>
            <li>The Issues inbox badge shows a count with urgency-based coloring</li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="IxCredits Rewards">
          <p>Responding to national issues earns IxCredits:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Base Reward:</strong> 5 IxCredits for responding to any issue
            </li>
            <li>
              <strong>Risk Bonus:</strong> 0-8 additional IxCredits based on the risk level of your
              chosen response
            </li>
            <li>
              Higher-risk choices yield more IxCredits but may have more negative consequences
            </li>
          </ul>
        </Section>

        <WarningBox title="Strategy Tips">
          Review your country&apos;s current snapshot data before making decisions. Higher-risk
          responses earn more IxCredits but can have significant negative effects on your metrics.
          Balance short-term rewards against long-term national health.
        </WarningBox>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Command Center
              </Link>{" "}
              — Where issues appear in your dashboard
            </li>
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits Economy
              </Link>{" "}
              — IxCredits earning details
            </li>
            <li>
              <Link
                href="/help/gameplay/simulation"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                How the Simulation Works
              </Link>{" "}
              — How the simulation engine works
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
