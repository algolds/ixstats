/**
 * Realm labels: names a realm's map editors (site admins, the founder, officers with the Map power) place on the
 * realm's map anywhere, not inside a nation: oceans, seas, regions and continents (`MapLabel` with `realmId` set
 * and no `countryId`). Client-safe.
 */

export const REALM_LABEL_TYPES = ["ocean", "sea", "region", "continent"] as const;

export type RealmLabelType = (typeof REALM_LABEL_TYPES)[number];

export const REALM_LABEL_TYPE_NAMES: Record<RealmLabelType, string> = {
  ocean: "Ocean",
  sea: "Sea",
  region: "Region",
  continent: "Continent",
};

export const REALM_LABEL_FONT_STYLES = ["normal", "italic"] as const;
export const REALM_LABEL_FONT_WEIGHTS = ["normal", "bold"] as const;

export interface RealmLabelStyle {
  fontSize: number;
  color: string;
  fontStyle: (typeof REALM_LABEL_FONT_STYLES)[number];
  fontWeight: (typeof REALM_LABEL_FONT_WEIGHTS)[number];
  letterSpacing: number;
  minZoom: number;
  maxZoom: number;
}

/** The style a new label of each type starts with: water in italic blue, land in spaced caps-like grey. */
export const REALM_LABEL_DEFAULTS: Record<RealmLabelType, RealmLabelStyle> = {
  ocean: {
    fontSize: 22,
    color: "#1a5276",
    fontStyle: "italic",
    fontWeight: "normal",
    letterSpacing: 0.3,
    minZoom: 0,
    maxZoom: 7,
  },
  sea: {
    fontSize: 15,
    color: "#2874a6",
    fontStyle: "italic",
    fontWeight: "normal",
    letterSpacing: 0.15,
    minZoom: 2,
    maxZoom: 9,
  },
  continent: {
    fontSize: 24,
    color: "#4b5563",
    fontStyle: "normal",
    fontWeight: "bold",
    letterSpacing: 0.4,
    minZoom: 0,
    maxZoom: 4,
  },
  region: {
    fontSize: 16,
    color: "#6b5b3d",
    fontStyle: "normal",
    fontWeight: "normal",
    letterSpacing: 0.2,
    minZoom: 2,
    maxZoom: 8,
  },
};
