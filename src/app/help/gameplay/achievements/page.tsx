import Link from "next/link";
import { Trophy, Star, Bell, Coins } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function AchievementsArticle() {
  return (
    <ArticleLayout
      title="Achievements & Progression"
      description="Achievement categories, rarity tiers, IxCredits rewards, and the unlock system."
      icon={Trophy}
    >
      <ContentCard>
        <Section title="Achievement System">
          <p>
            Achievements are automatic rewards that unlock when your country data meets specific
            criteria. The Achievement Service monitors country changes and checks unlock conditions
            whenever data updates, so you never need to manually claim achievements.
          </p>
        </Section>

        <Section title="Rarity Tiers & Rewards">
          <InfoBox title="Achievement Rarities">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Common</strong> — 5 IxCredits. Basic milestones like creating your first
                country or establishing your first embassy.
              </li>
              <li>
                <strong>Uncommon</strong> — 10 IxCredits. Intermediate goals like reaching specific
                GDP thresholds or diplomatic relationship counts.
              </li>
              <li>
                <Star className="inline h-4 w-4 text-blue-500" /> <strong>Rare</strong> — 25
                IxCredits. Significant accomplishments like top-10 leaderboard placement or advanced
                military readiness.
              </li>
              <li>
                <Star className="inline h-4 w-4 text-purple-500" /> <strong>Epic</strong> — 50
                IxCredits. Major milestones like reaching higher economic tiers or completing
                complex diplomatic missions.
              </li>
              <li>
                <Star className="inline h-4 w-4 text-amber-500" /> <strong>Legendary</strong> — 100
                IxCredits. The rarest achievements for exceptional accomplishments. Some legendary
                achievements also award special cards.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Achievement Categories">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Coins className="inline h-4 w-4 text-amber-500" /> <strong>Economic:</strong> GDP
              milestones, growth rate targets, trade volume thresholds, economic tier advancement
            </li>
            <li>
              <strong>Diplomatic:</strong> Embassy count goals, alliance formation, cultural
              exchange completion, diplomatic influence ranking
            </li>
            <li>
              <strong>Military:</strong> Military readiness levels, equipment milestones, operation
              completion, defense score thresholds
            </li>
            <li>
              <strong>Social:</strong> ThinkPages engagement metrics, ThinkTank participation,
              collaboration milestones
            </li>
            <li>
              <strong>Collection:</strong> Card collection completeness, rare card acquisitions,
              vault level milestones
            </li>
          </ul>
        </Section>

        <Section title="Notification & Display">
          <p>
            <Bell className="inline h-4 w-4 text-blue-500" /> When an achievement unlocks:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Unlock Modal:</strong> A celebration modal appears with the achievement
              details and IxCredits reward
            </li>
            <li>
              <strong>Real-Time Notifications:</strong> Achievement alerts appear in the
              notification feed
            </li>
            <li>
              <strong>Achievement Tooltips:</strong> Hover over achievement badges for detailed
              information
            </li>
            <li>
              <strong>Constellation Map:</strong> Visual progress map showing unlocked and locked
              achievements
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/vault/ixcredits"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                IxCredits Economy
              </Link>{" "}
              — IxCredits earning and spending
            </li>
            <li>
              <Link
                href="/help/gameplay/leaderboards"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Leaderboards &amp; Rankings
              </Link>{" "}
              — Competitive rankings
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
