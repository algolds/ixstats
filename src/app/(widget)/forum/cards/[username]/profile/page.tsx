/**
 * Profile Widget — Medium-size card showcase for XenForo user profiles.
 * Shows top 6 rarest cards in a 3×2 grid with summary stats.
 *
 * Route: /forum/cards/[username]/profile
 */

import { db } from "~/server/db";
import { rarityRank, computeRarityCounts, formatValue } from "~/shared/forum-utils";
import { ForumMiniCard } from "../ForumMiniCard";
import { ForumRarityBar } from "../ForumRarityBar";
import { styles } from "../widget-styles";
import { withBasePath } from "~/lib/base-path";

const PROFILE_CARD_LIMIT = 6;

export default async function ForumProfileWidget({
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
    return <div style={styles.empty}>No IxStats account linked.</div>;
  }

  // Get all ownerships for summary, but only show top 6
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
        },
      },
    },
  });

  const sorted = ownerships.sort((a, b) => rarityRank(b.cards.rarity) - rarityRank(a.cards.rarity));
  const top = sorted.slice(0, PROFILE_CARD_LIMIT);
  const allCards = sorted.map((o) => o.cards);
  const totalValue = allCards.reduce((sum, c) => sum + c.marketValue, 0);
  const rarityCounts = computeRarityCounts(allCards);

  if (sorted.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No IxCards collected yet.</p>
      </div>
    );
  }

  const showcaseUrl = withBasePath(
    `/forum/cards/${encodeURIComponent(user.forumUsername ?? decodedName)}`
  );

  return (
    <div style={{ padding: 12 }}>
      {/* Compact Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user.country?.flag && <img src={user.country.flag} alt="" style={styles.flag} />}
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>IxCards</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Lvl {user.collectorLevel}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ ...styles.statBadge, fontSize: 11 }}>{sorted.length} cards</span>
          <span style={{ ...styles.statBadge, fontSize: 11 }}>{formatValue(totalValue)}</span>
        </div>
      </div>

      {/* Rarity Bar */}
      <ForumRarityBar rarityCounts={rarityCounts} totalCards={sorted.length} />

      {/* Top Cards Grid */}
      <div style={styles.gridCompact}>
        {top.map((o) => (
          <ForumMiniCard key={o.id} card={o.cards} compact />
        ))}
      </div>

      {/* View All Link */}
      {sorted.length > PROFILE_CARD_LIMIT && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a
            href={showcaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...styles.link,
              fontSize: 12,
              padding: "6px 16px",
              borderRadius: 6,
              background: "rgba(96,165,250,0.1)",
              border: "1px solid rgba(96,165,250,0.2)",
              display: "inline-block",
            }}
          >
            View all {sorted.length} cards →
          </a>
        </div>
      )}
    </div>
  );
}
