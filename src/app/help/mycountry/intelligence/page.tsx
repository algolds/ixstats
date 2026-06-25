"use client";

import { Brain, BarChart3, Search, Bell } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryIntelligenceArticle() {
  return (
    <ArticleLayout
      title="Reading the Room"
      description="Insights that turn your nation's numbers into clear next moves."
      icon={Brain}
    >
      <ContentCard>
        <Section title="Your Nation, Made Sense Of">
          <p>
            Intelligence is where the raw numbers become a story you can act on. There&rsquo;s
            nothing to manage here — it&rsquo;s pure insight, laid out in three views:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Dashboard</strong> — the headline read on how your nation is doing.
            </li>
            <li>
              <strong>Analysis</strong> — deeper dives into your economy, relationships, and
              policies.
            </li>
            <li>
              <strong>Reports</strong> — the findings worth knowing, sorted by what matters most.
            </li>
          </ul>
        </Section>

        <Section title="The Dashboard">
          <p>A quick health check across the things that keep you up at night:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Security</strong> — how safe your nation is, drawn from your defense and
              stability.
            </li>
            <li>
              <strong>Open alerts</strong> — how many things are flagged for your attention.
            </li>
            <li>
              <strong>Embassy coverage</strong> — how well-connected you are to the nations that
              matter.
            </li>
            <li>
              <strong>Overall picture</strong> — everything above, rolled into one read.
            </li>
          </ul>
        </Section>

        <Section title="Digging Deeper">
          <InfoBox title="Three ways to analyze">
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <BarChart3 className="inline h-4 w-4" /> <strong>Economy</strong> — growth trends,
                which sectors are pulling their weight, trade outlook, and how you compare.
              </li>
              <li>
                <Search className="inline h-4 w-4" /> <strong>Diplomacy</strong> — how your
                relationships are trending and where your alliances are strong or fraying.
              </li>
              <li>
                <Bell className="inline h-4 w-4" /> <strong>Policy</strong> — what&rsquo;s working,
                and a chance to test a new idea before you commit to it.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="The Findings That Matter">
          <p>
            The Reports view surfaces the things worth knowing — each with how serious it is, what
            it touches, and what you might do about it. They&rsquo;re drawn straight from real
            shifts in your economy, your relationships, and your security, so they&rsquo;re always
            about your nation right now.
          </p>
        </Section>

        <Section title="Tune Your Alerts">
          <p>
            Want to hear about a problem the moment it appears — or only when it gets serious? Set
            your own thresholds for economic swings, changing relationships, and security events, so
            you get the heads-up that suits how you like to play.
          </p>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/intelligence/dashboard"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Your Situation Room
              </Link>{" "}
              — a closer look at the dashboard.
            </li>
            <li>
              <Link
                href="/help/intelligence/alerts"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Alerts &amp; Live Updates
              </Link>{" "}
              — staying ahead of what&rsquo;s happening.
            </li>
            <li>
              <Link
                href="/help/intelligence/forecasting"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Looking Ahead
              </Link>{" "}
              — where your nation is headed.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
