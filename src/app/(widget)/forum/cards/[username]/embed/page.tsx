/**
 * Post Sidebar Embed — Compact card widget for XenForo post user info sidebar.
 * Shows top 3 rarest cards as small thumbnails with a summary line.
 *
 * Route: /forum/cards/[username]/embed
 */

import { db } from "~/server/db";
import { rarityRank, formatValue, getRarityColors } from "~/lib/forum/forum-utils";
import { styles } from "../widget-styles";
import { withBasePath } from "~/lib/base-path";

const EMBED_CARD_LIMIT = 3;

export default async function ForumPostEmbed({
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
      country: { select: { name: true } },
    },
  });

  if (!user) return null;

  const ownerships = await db.cardOwnership.findMany({
    where: { ownerId: user.id },
    include: {
      cards: {
        select: {
          id: true,
          title: true,
          artwork: true,
          rarity: true,
          marketValue: true,
        },
      },
    },
  });

  if (ownerships.length === 0) return null;

  const sorted = ownerships.sort((a, b) => rarityRank(b.cards.rarity) - rarityRank(a.cards.rarity));
  const top = sorted.slice(0, EMBED_CARD_LIMIT);
  const totalValue = sorted.reduce((sum, o) => sum + o.cards.marketValue, 0);

  const showcaseUrl = withBasePath(
    `/forum/cards/${encodeURIComponent(user.forumUsername ?? decodedName)}`
  );

  return (
    <div style={{ padding: "6px 4px", maxWidth: 160, margin: "0 auto" }}>
      {/* Mini card thumbnails */}
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
        {top.map((o) => {
          const colors = getRarityColors(o.cards.rarity);
          const artworkUrl = o.cards.artwork || "";
          return (
            <div
              key={o.id}
              title={`${o.cards.title} (${colors.label})`}
              style={{
                width: 44,
                height: 62,
                borderRadius: 4,
                overflow: "hidden",
                border: `2px solid ${colors.border}`,
                boxShadow: colors.glow,
                background: "rgba(0,0,0,0.3)",
                flexShrink: 0,
              }}
            >
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt={o.cards.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    color: "#6b7280",
                  }}
                >
                  ?
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      <div
        style={{
          textAlign: "center",
          marginTop: 6,
          fontSize: 10,
          color: "#9ca3af",
          lineHeight: 1.3,
        }}
      >
        {sorted.length} cards · {formatValue(totalValue)}
      </div>

      {/* Link */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <a
          href={showcaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...styles.link,
            fontSize: 10,
          }}
        >
          View Cards
        </a>
      </div>
    </div>
  );
}
