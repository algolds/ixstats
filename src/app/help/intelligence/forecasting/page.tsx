import Link from "next/link";
import { ChartLine, CalendarClock, LayoutDashboard } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ForecastingArticle() {
  return (
    <ArticleLayout
      title="Forecasting & Predictions"
      description="Plan ahead with forward-looking analytics that help you anticipate challenges and prepare your nation for what's coming."
      icon={ChartLine}
    >
      <ContentCard>
        <Section title="How Forecasting Helps You">
          <p className="mb-4">
            Your intelligence system doesn&apos;t just tell you what&apos;s happening now -- it
            looks ahead. Forecasts combine your economic trajectory, diplomatic trends, and social
            indicators to project where your nation is heading. This gives you time to act before
            problems become crises and position yourself to take advantage of emerging
            opportunities.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Economic Projections:</strong> See where your GDP, trade balance, and fiscal
              health are trending over the coming periods. Spot potential deficits or growth
              opportunities early.
            </li>
            <li>
              <strong>Diplomatic Trend Analysis:</strong> Track how your relationships with other
              nations are evolving based on mission outcomes and recent interactions.
            </li>
            <li>
              <strong>Social Sentiment:</strong> Gauge the mood of your population based on
              ThinkPages activity, policy impact, and national events.
            </li>
          </ul>
        </Section>

        <Section title="Where to Find Forecasts">
          <InfoBox title="Forecast Locations">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Intelligence Feed:</strong> The Forward-Looking section on your{" "}
                <Link
                  href="/mycountry/intelligence"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Intelligence page
                </Link>{" "}
                highlights the most important predictions and their confidence levels.
              </li>
              <li>
                <strong>Economic Analytics:</strong> Scenario cards and projection charts in your
                economy section let you explore different possible futures side by side.
              </li>
              <li>
                <strong>Policy Impact Previews:</strong> When you create or adjust policies,
                you&apos;ll see estimated impacts on your key metrics before you commit.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Turning Predictions into Action">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Plan ahead for deficits:</strong> When forecasts predict economic downturns or
              resource shortages, set compliance reminders and begin adjusting spending or trade
              policies early.
            </li>
            <li>
              <strong>Document your assumptions:</strong> Write a ThinkPages post explaining what
              you expect to happen and why. When outcomes differ, revisiting your reasoning helps
              you make better predictions next time.
            </li>
            <li>
              <strong>Coordinate across domains:</strong> High-risk forecasts may require responses
              from defense, diplomacy, and economics simultaneously. Use the dashboard to see the
              full picture and plan a coordinated response.
            </li>
            <li>
              <strong>Watch for cascading effects:</strong> A diplomatic deterioration might lead to
              trade disruptions, which could impact your economy. Forecasts help you trace these
              chains before they play out.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Guides">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <CalendarClock className="inline h-4 w-4" />{" "}
              <Link
                href="/help/economy/modeling"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Economic Modeling
              </Link>{" "}
              -- explore detailed scenario planning for your economy.
            </li>
            <li>
              <LayoutDashboard className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Executive Intelligence Dashboard
              </Link>{" "}
              -- see forecasts alongside your current metrics in one view.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
