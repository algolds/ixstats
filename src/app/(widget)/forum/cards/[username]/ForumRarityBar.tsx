/**
 * ForumRarityBar — Server component showing rarity distribution as a horizontal bar.
 */

import { RARITY_INLINE_COLORS } from "~/lib/forum/forum-utils";
import { styles } from "./widget-styles";

// Display order: LEGENDARY → COMMON (highest first)
const RARITY_ORDER = ["LEGENDARY", "EPIC", "ULTRA_RARE", "RARE", "UNCOMMON", "COMMON"] as const;

interface ForumRarityBarProps {
  rarityCounts: Record<string, number>;
  totalCards: number;
}

export function ForumRarityBar({ rarityCounts, totalCards }: ForumRarityBarProps) {
  if (totalCards === 0) return null;

  return (
    <div>
      <div style={styles.rarityBar}>
        {RARITY_ORDER.map((rarity) => {
          const count = rarityCounts[rarity] ?? 0;
          if (count === 0) return null;
          const pct = (count / totalCards) * 100;
          const colors = RARITY_INLINE_COLORS[rarity]!;
          return (
            <div
              key={rarity}
              title={`${colors.label}: ${count}`}
              style={{
                width: `${pct}%`,
                backgroundColor: colors.primary,
                minWidth: 4,
                transition: "width 0.3s",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
          fontSize: 11,
          color: "#9ca3af",
        }}
      >
        {RARITY_ORDER.map((rarity) => {
          const count = rarityCounts[rarity] ?? 0;
          if (count === 0) return null;
          const colors = RARITY_INLINE_COLORS[rarity]!;
          return (
            <span key={rarity} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: colors.primary,
                }}
              />
              {colors.label}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
