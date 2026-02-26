"use client";

import { Vote, Users, Scale, BarChart3 } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryPoliticsArticle() {
  return (
    <ArticleLayout
      title="MyCountry Politics"
      description="Legislature configuration, political parties, and election simulation from the Politics tab."
      icon={Vote}
    >
      <ContentCard>
        <Section title="Politics Tab Layout">
          <p>
            The Politics section governs your nation&apos;s electoral and legislative systems:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>Overview:</strong> Political health vitality rings and summary statistics</li>
            <li><strong>Legislature:</strong> Legislature configuration, seat allocation, and legislative business</li>
            <li><strong>Parties:</strong> Political party creation and management</li>
            <li><strong>Elections:</strong> Election simulation with seat allocation algorithms</li>
          </ul>
        </Section>

        <Section title="Overview Tab">
          <p>
            Vitality rings show your political system&apos;s health:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>Party Count:</strong> Number of active political parties</li>
            <li><strong>Legislature Seats:</strong> Filled seats vs. total legislature capacity</li>
            <li><strong>Completed Elections:</strong> Number of elections held</li>
            <li><strong>Government Metrics:</strong> Approval ratings and governance effectiveness</li>
          </ul>
        </Section>

        <Section title="Legislature">
          <InfoBox title="Legislature Configuration">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Scale className="inline h-4 w-4" />{" "}
                <strong>Electoral System:</strong> Choose between D&apos;Hondt proportional
                representation or First-Past-The-Post (FPTP) seat allocation
              </li>
              <li><strong>Seat Count:</strong> Configure total legislature seats</li>
              <li><strong>Legislative Issues:</strong> Track bills and resolutions before the legislature</li>
              <li><strong>Legislative Policies:</strong> View enacted policies and their legislative history</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Political Parties">
          <p>
            <Users className="inline h-4 w-4 text-purple-500" /> Create and manage political
            parties for your nation:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Define party name, ideology, platform, and color</li>
            <li>Set party popularity and base support levels</li>
            <li>Parties compete in elections for legislature seats</li>
            <li>Track party performance across election cycles</li>
          </ul>
        </Section>

        <Section title="Elections">
          <p>
            <BarChart3 className="inline h-4 w-4 text-blue-500" /> Run election simulations to
            allocate legislature seats:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>D&apos;Hondt Method:</strong> Proportional representation allocating seats by party vote share using divisor method</li>
            <li><strong>FPTP:</strong> Winner-takes-all in each constituency</li>
            <li>Results show seat counts, vote shares, and government formation</li>
            <li>Election history tracked for trend analysis</li>
          </ul>
        </Section>

        <WarningBox title="Prerequisites">
          You need at least two political parties configured and a legislature set up before you
          can run election simulations. Configure these in the Legislature and Parties tabs first.
        </WarningBox>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li><Link href="/help/government/components" className="text-blue-600 hover:underline dark:text-blue-400">Component Catalog</Link>{" "} — Government system components</li>
            <li><Link href="/help/mycountry/executive" className="text-blue-600 hover:underline dark:text-blue-400">Executive Command Center</Link>{" "} — Executive command center</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
