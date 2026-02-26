/**
 * Full Card Showcase — Server-rendered page showing a user's complete card collection.
 * Can be visited directly or iframed into XenForo as a dedicated cards page.
 *
 * Route: /forum/cards/[username]
 */

import { db } from "~/server/db";
import { rarityRank, computeRarityCounts, formatValue } from "~/lib/forum-widget-utils";
import { ForumMiniCard } from "./ForumMiniCard";
import { ForumRarityBar } from "./ForumRarityBar";
import { styles } from "./widget-styles";

export default async function ForumCardsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decodedName = decodeURIComponent(username);

  const user = await db.user.findFirst({
    where: { forumUsername: { equals: decodedName, mode: "insensitive" } },
    select: {
      id: true,
      forumUsername: true,
      collectorLevel: true,
      country: { select: { name: true, flag: true } },
    },
  });

  if (!user) {
    return (
      <div style={styles.empty}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>User not found</p>
        <p>No IxStats account is linked to the forum username &ldquo;{decodedName}&rdquo;.</p>
      </div>
    );
  }

  const ownerships = await db.cardOwnership.findMany({
    where: { ownerId: user.id },
    include: {
      cards: {
        select: {
          id: true,
          title: true,
          artwork: true,
          rarity: true,
          cardType: true,
          marketValue: true,
          season: true,
        },
      },
    },
  });

  // Sort by rarity (highest first), then by value
  const sorted = ownerships.sort((a, b) => {
    const rDiff = rarityRank(b.cards.rarity) - rarityRank(a.cards.rarity);
    if (rDiff !== 0) return rDiff;
    return b.cards.marketValue - a.cards.marketValue;
  });

  const allCards = sorted.map((o) => o.cards);
  const totalValue = allCards.reduce((sum, c) => sum + c.marketValue, 0);
  const rarityCounts = computeRarityCounts(allCards);

  if (sorted.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>No cards yet</p>
        <p>{user.forumUsername} hasn&apos;t collected any IxCards yet.</p>
        <a
          href="https://ixwiki.com/projects/ixstats/vault"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...styles.link, marginTop: 12, display: "inline-block" }}
        >
          Visit IxStats to start collecting
        </a>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {user.country?.flag && (
<img
              src={user.country.flag}
              alt={user.country.name ?? ""}
              style={styles.flag}
            />
          )}
          <div>
            <h1 style={styles.title}>
              {user.forumUsername}&apos;s Collection
            </h1>
            <p style={styles.subtitle}>
              {user.country?.name ?? "Unknown Nation"} · Collector Lvl {user.collectorLevel}
            </p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.statBadge}>
            {sorted.length} cards
          </span>
          <span style={styles.statBadge}>
            {formatValue(totalValue)}
          </span>
        </div>
      </div>

      {/* Rarity Distribution */}
      <ForumRarityBar rarityCounts={rarityCounts} totalCards={sorted.length} />

      {/* Card Grid */}
      <div style={styles.grid}>
        {sorted.map((o) => (
          <ForumMiniCard
            key={o.id}
            card={o.cards}
            serialNumber={o.serialNumber}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span>
          Powered by{" "}
          <a
            href="https://ixwiki.com/projects/ixstats"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            IxStats
          </a>
        </span>
        <a
          href="https://ixwiki.com/projects/ixstats/vault"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          Open Vault
        </a>
      </div>
    </div>
  );
}
