"use client";

import { Command, Calendar, FileText, Bell, Target } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ExecutiveArticle() {
  return (
    <ArticleLayout
      title="The Executive Desk"
      description="Hold cabinet meetings, set national policy, and make the big calls that move your nation."
      icon={Command}
    >
      <ContentCard>
        <Section title="Where the Big Decisions Happen">
          <p>
            This is the desk where you actually lead. Find it under{" "}
            <strong>MyCountry &rarr; Executive</strong>. It brings the issues on your plate, your
            cabinet, your policies, and your boldest moves together in one place.
          </p>
        </Section>

        <Section title="What You'll Do Here">
          <div className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Target className="h-4 w-4 text-rose-600" />
                The Intent Engine
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                State your plain-language goals using the Intent Composer. You can authorize a package directly to run it immediately, or click <strong>Propose as Cabinet Goal</strong> to schedule a deliberation session with your ministers, bypassing active weekly cooldowns.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4 text-purple-600" />
                Cabinet Meetings &amp; Deliberation
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Convene scheduled cabinet meetings to address proposed intents. Opening a session lets you select between three ministry courses (Measured, Moderate, or Extreme) to commit resources, adjust department budgets, activate policies, and complete the meeting in one click.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <Bell className="h-4 w-4 text-amber-600" />
                National Issues &amp; Resistance
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Active intents generate thematic national issues with 2.0x probability, representing resistance or support from your nation's groups. Diplomatic and foreign issues dynamically pull actual neighbor leaders, regions, and GDP stats directly from the database.
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-indigo-600" />
                Policies &amp; Strategy
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Track active policies and draft custom strategies across every ministry. Custom strategies automatically scale their capacity cost and volatility risk based on selected priorities.
              </p>
            </div>
          </div>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Quick Starts">
          <p>Jump straight into the things you do most:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Review issues</strong> — open your inbox and respond to what&rsquo;s waiting.
            </li>
            <li>
              <strong>Schedule a meeting</strong> — set up a new cabinet session.
            </li>
            <li>
              <strong>Create a policy</strong> — start drafting something new.
            </li>
            <li>
              <strong>Plan ahead</strong> — sketch out a long-term initiative with milestones.
            </li>
          </ul>
        </Section>

        <Section title="How It Connects">
          <p>The Executive desk pulls from the rest of your nation:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Intelligence</strong> — the insights and findings that should inform your
              calls.
            </li>
            <li>
              <strong>Diplomacy</strong> — foreign-policy decisions tie back to your relationships
              abroad.
            </li>
            <li>
              <strong>Defense</strong> — your readiness and security shape your options in a crisis.
            </li>
            <li>
              <strong>Overview</strong> — see the effect of your choices on your nation&rsquo;s
              vital signs.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Target className="inline h-4 w-4" />{" "}
              <Link
                href="/help/gameplay/national-issues"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                National Issues &amp; Decisions
              </Link>{" "}
              — how events arrive and why your choices stick.
            </li>
            <li>
              <Calendar className="inline h-4 w-4" />{" "}
              <Link
                href="/help/intelligence/executive-operations"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Command &amp; Operations
              </Link>{" "}
              — running your nation&rsquo;s biggest moves.
            </li>
            <li>
              <FileText className="inline h-4 w-4" />{" "}
              <Link
                href="/help/government/components"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The Component Library
              </Link>{" "}
              — the building blocks behind your government.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
