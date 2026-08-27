/**
 * ForumMiniCard — Server component rendering a single card for forum widgets.
 * Uses inline CSS for rarity-colored borders and glow effects.
 */

import { getRarityColors, formatValue, resolveArtworkUrl } from "~/lib/forum/forum-utils";
import { styles } from "./widget-styles";
import { withBasePath } from "~/lib/base-path";

interface ForumMiniCardProps {
  card: {
    id: string;
    title: string;
    artwork: string | null;
    rarity: string;
    cardType: string;
    marketValue: number;
  };
  serialNumber?: number;
  basePath?: string;
  compact?: boolean;
}

export function ForumMiniCard({
  card,
  serialNumber,
  basePath = "",
  compact = false,
}: ForumMiniCardProps) {
  const colors = getRarityColors(card.rarity);
  const artworkUrl = resolveArtworkUrl(card.artwork, basePath);
  const cardUrl = withBasePath("/vault");

  return (
    <a
      href={cardUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...styles.card,
        borderColor: colors.border,
        boxShadow: colors.glow,
      }}
    >
      <img src={artworkUrl} alt={card.title} style={styles.cardImage} loading="lazy" />
      <div style={styles.cardInfo}>
        <p
          style={{
            ...styles.cardTitle,
            fontSize: compact ? 10 : 12,
          }}
        >
          {card.title}
        </p>
        <div style={styles.cardMeta}>
          <span style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                ...styles.rarityDot,
                backgroundColor: colors.primary,
                boxShadow: colors.glow !== "none" ? colors.glow : undefined,
              }}
            />
            {colors.label}
          </span>
          {!compact && <span>{formatValue(card.marketValue)}</span>}
        </div>
        {serialNumber != null && !compact && (
          <div className="text-[9px] text-muted-foreground mt-0.5">#{serialNumber}</div>
        )}
      </div>
    </a>
  );
}
