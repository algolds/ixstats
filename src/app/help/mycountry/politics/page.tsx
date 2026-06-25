"use client";

import { Vote, Users, Scale, BarChart3 } from "lucide-react";
import Link from "next/link";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function MyCountryPoliticsArticle() {
  return (
    <ArticleLayout
      title="Politics &amp; Elections"
      description="Your legislature, political parties, and the elections that decide who holds power."
      icon={Vote}
    >
      <ContentCard>
        <Section title="How It's Laid Out">
          <p>Everything about who governs your nation lives here, across four areas:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Overview</strong> — the health of your political scene at a glance.
            </li>
            <li>
              <strong>Legislature</strong> — how your parliament is set up and what it&rsquo;s
              working on.
            </li>
            <li>
              <strong>Parties</strong> — the political movements you create and shape.
            </li>
            <li>
              <strong>Elections</strong> — run a vote and see who wins.
            </li>
          </ul>
        </Section>

        <Section title="At a Glance">
          <p>The overview sums up your political system:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Parties</strong> — how many are active.
            </li>
            <li>
              <strong>Seats</strong> — how full your legislature is.
            </li>
            <li>
              <strong>Elections held</strong> — your electoral track record.
            </li>
            <li>
              <strong>Standing</strong> — approval and how effectively your government is seen to
              govern.
            </li>
          </ul>
        </Section>

        <Section title="Your Legislature">
          <InfoBox title="Setting up parliament">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <Scale className="inline h-4 w-4" /> <strong>Voting system</strong> — choose{" "}
                <strong>proportional representation</strong> (D&apos;Hondt — seats roughly match
                each party&rsquo;s share of the vote) or <strong>first-past-the-post</strong> (the
                winner in each seat takes it). The choice shapes your whole political character.
              </li>
              <li>
                <strong>Size</strong> — set how many seats your legislature has.
              </li>
              <li>
                <strong>Business</strong> — track the bills and resolutions on the floor.
              </li>
              <li>
                <strong>History</strong> — look back at what&rsquo;s been passed and when.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Political Parties">
          <p>
            <Users className="inline h-4 w-4 text-purple-500" /> Build the parties that bring your
            nation&rsquo;s politics to life:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Give each one a name, ideology, platform, and color.</li>
            <li>Set how popular it is and where its support comes from.</li>
            <li>Watch them compete for seats at election time.</li>
            <li>Follow how their fortunes rise and fall across the years.</li>
          </ul>
        </Section>

        <Section title="Elections">
          <p>
            <BarChart3 className="inline h-4 w-4 text-blue-500" /> Run an election and watch the
            seats fall:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Proportional (D&apos;Hondt)</strong> — a party that wins a third of the vote
              ends up with roughly a third of the seats. Smaller parties get a real voice.
            </li>
            <li>
              <strong>First-past-the-post</strong> — whoever wins each seat takes it outright. Big
              parties tend to win big.
            </li>
            <li>Results show you seat counts, vote shares, and who forms the government.</li>
            <li>Every election is saved, so you can watch the story of your politics unfold.</li>
          </ul>
        </Section>

        <WarningBox title="Before You Can Vote">
          You&rsquo;ll need at least two parties and a legislature set up before you can run an
          election. Sort those out in the Parties and Legislature areas first.
        </WarningBox>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/government/components"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The Component Library
              </Link>{" "}
              — the building blocks of your government.
            </li>
            <li>
              <Link
                href="/help/mycountry/executive"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The Executive Desk
              </Link>{" "}
              — where leadership turns into action.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
