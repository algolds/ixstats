"use client";

import { Shield, Swords, Crosshair, Settings } from "lucide-react";
import Link from "next/link";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MyCountryDefenseArticle() {
  return (
    <ArticleLayout
      title="Defense &amp; Security"
      description="Command your military, shape your forces, and keep your nation secure."
      icon={Shield}
    >
      <ContentCard>
        <Section title="How It's Laid Out">
          <p>Everything about your nation&rsquo;s security sits in three areas:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Command</strong> — the big-picture read on threats and readiness.
            </li>
            <li>
              <strong>Forces</strong> — your branches, your troops, and the gear they carry.
            </li>
            <li>
              <strong>Operations</strong> — what your military is actually doing right now.
            </li>
          </ul>
        </Section>

        <Section title="Command">
          <p>A clear view of how safe your nation is:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Crosshair className="inline h-4 w-4 text-red-500" /> <strong>Threat level</strong> —
              where things stand, and what&rsquo;s driving it.
            </li>
            <li>
              <strong>Readiness</strong> — how prepared your forces are across the board.
            </li>
            <li>
              <strong>Threats</strong> — what&rsquo;s out there and worth watching.
            </li>
            <li>
              <strong>Needs attention</strong> — the defense matters waiting on a decision from you.
            </li>
          </ul>
        </Section>

        <Section title="Forces">
          <InfoBox title="Building your military">
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <Swords className="inline h-4 w-4" /> <strong>Branches</strong> — set up your army,
                navy, air force, and special forces, and decide how many serve in each.
              </li>
              <li>
                <strong>Equipment</strong> — kit out your forces from a deep, real-world-inspired
                armory.
              </li>
              <li>
                <strong>Make-up</strong> — balance active troops, reserves, and the support that
                keeps them going.
              </li>
              <li>
                <strong>At a glance</strong> — branch count, average readiness, and your overall
                security score.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Operations">
          <p>Plan and follow what your forces are doing:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <Settings className="inline h-4 w-4 text-blue-500" />{" "}
              <strong>What&rsquo;s active</strong> — keep tabs on every deployment in progress.
            </li>
            <li>
              <strong>Plan a deployment</strong> — a step-by-step walk-through for setting
              objectives, committing forces, and timing your move.
            </li>
            <li>
              <strong>Conflicts</strong> — manage and resolve standoffs with other nations.
            </li>
          </ul>
        </Section>

        <InfoBox title="Keep Exploring">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/defense/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Defense Overview
              </Link>{" "}
              — where to start with your military.
            </li>
            <li>
              <Link
                href="/help/defense/units"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Units &amp; Assets
              </Link>{" "}
              — the forces at your command.
            </li>
            <li>
              <Link
                href="/help/defense/equipment"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                The Equipment Catalog
              </Link>{" "}
              — the armory you&rsquo;ll outfit them from.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
