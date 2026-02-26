/**
 * Inline CSS style constants for forum widget pages.
 * All styles are CSS-in-JS (React.CSSProperties) since widgets
 * don't load the Tailwind CSS bundle.
 */

import type { CSSProperties } from "react";

export const styles = {
  // ─── Layout ────────────────────────────────────────────────
  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "16px",
  } satisfies CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  } satisfies CSSProperties,

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    fontSize: 13,
    color: "#9ca3af",
  } satisfies CSSProperties,

  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#f3f4f6",
    margin: 0,
  } satisfies CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    margin: 0,
  } satisfies CSSProperties,

  statBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#d1d5db",
  } satisfies CSSProperties,

  // ─── Card Grid ─────────────────────────────────────────────
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  gridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  } satisfies CSSProperties,

  gridMedium: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 10,
  } satisfies CSSProperties,

  // ─── Card ──────────────────────────────────────────────────
  card: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    transition: "transform 0.2s, box-shadow 0.2s",
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  } satisfies CSSProperties,

  cardImage: {
    width: "100%",
    aspectRatio: "2.5 / 3.5",
    objectFit: "cover",
    display: "block",
    backgroundColor: "rgba(0,0,0,0.3)",
  } satisfies CSSProperties,

  cardInfo: {
    padding: "8px 10px",
  } satisfies CSSProperties,

  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#f3f4f6",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    margin: 0,
  } satisfies CSSProperties,

  cardMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    fontSize: 10,
    color: "#9ca3af",
  } satisfies CSSProperties,

  rarityDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    marginRight: 4,
    flexShrink: 0,
  } satisfies CSSProperties,

  // ─── Rarity Bar ────────────────────────────────────────────
  rarityBar: {
    display: "flex",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 16,
    background: "rgba(255,255,255,0.05)",
  } satisfies CSSProperties,

  // ─── Footer ────────────────────────────────────────────────
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    color: "#6b7280",
  } satisfies CSSProperties,

  link: {
    color: "#60a5fa",
    textDecoration: "none",
    fontWeight: 500,
  } satisfies CSSProperties,

  // ─── Empty / Error States ──────────────────────────────────
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#6b7280",
    fontSize: 14,
  } satisfies CSSProperties,

  flag: {
    width: 24,
    height: 16,
    objectFit: "cover",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,0.1)",
  } satisfies CSSProperties,
} as const;
