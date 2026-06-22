"use client";

import Link from "next/link";
import { BookOpen, Search, Sparkles, FileText } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function LoreCardsArticle() {
  return (
    <ArticleLayout
      title="Lore Cards"
      description="Wiki-generated cards with article content, forum links, and holographic effects."
      icon={BookOpen}
    >
      <ContentCard>
        <Section title="What Are Lore Cards?">
          <p>
            Lore Cards are a unique card type generated from IxWiki articles. Each card features an
            excerpt from a wiki article, a link to the source material, and visual effects based on
            the article&apos;s importance and content quality.
          </p>
          <p className="mt-3">
            Unlike nation cards which represent countries, lore cards capture the world-building
            content of the IxWiki — historical events, cultural phenomena, notable figures,
            organizations, and more.
          </p>
        </Section>

        <Section title="Finding Articles">
          <p>
            <Search className="inline h-4 w-4 text-blue-500" /> Use the article search to find wiki
            articles worth turning into cards. Search by title, category, or keyword, and it&apos;ll
            pull matching articles from across IxWiki.
          </p>
        </Section>

        <Section title="Generation Process">
          <InfoBox title="How Lore Cards Are Created">
            <ol className="list-decimal space-y-1 pl-6">
              <li>Search for a wiki article using the Article Search</li>
              <li>The Lore Card Generator extracts key information from the article</li>
              <li>Card layout is composed with wiki excerpt and metadata</li>
              <li>Rarity is assigned based on article quality and content</li>
              <li>The card is added to your collection</li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Card Display">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <FileText className="inline h-4 w-4 text-indigo-500" /> <strong>Wiki Excerpt:</strong>{" "}
              A formatted excerpt from the source article displayed on the card face
            </li>
            <li>
              <strong>Forum Section:</strong> Links to related forum discussions about the article
              topic
            </li>
            <li>
              <Sparkles className="inline h-4 w-4 text-amber-500" />{" "}
              <strong>Holographic Effects:</strong> Higher-rarity lore cards feature holographic
              cover animations with light refraction effects
            </li>
            <li>
              <strong>Source Link:</strong> Direct link back to the original IxWiki article
            </li>
          </ul>
        </Section>

        <Section title="Collecting Lore Cards">
          <p>Lore cards can be obtained in three ways:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Card Packs:</strong> Random lore cards may appear in pack openings
            </li>
            <li>
              <strong>Trading:</strong> Trade with other players on the marketplace
            </li>
            <li>
              <strong>Generation:</strong> Create lore cards directly from wiki articles
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/vault/overview"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Vault Overview
              </Link>{" "}
              - Vault system overview
            </li>
            <li>
              <Link
                href="/help/vault/card-packs"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Card Packs &amp; Opening
              </Link>{" "}
              - Pack opening and card acquisition
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
