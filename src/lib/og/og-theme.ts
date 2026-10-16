/**
 * The fixed palette and canvas of the link-unfurl images (`opengraph-image.tsx`). Satori cannot read
 * CSS variables, so the colours are the Facet tokens' light values read from the TS source of truth
 * (`src/lib/design/tokens.ts`) rather than copied: if the tokens move, the cards follow.
 *
 * Passport pages carry no `data-app`, so the passport card uses the default shell tint (iron-gall ink);
 * realm pages belong to Realms, so the realm card wears the Realms tint (banner purpure). The images are
 * always light, a paper document whatever the reader's theme.
 */
import { APP_TINTS, COLOR_ROLES } from "~/lib/design/tokens";

const LIGHT = COLOR_ROLES.light;
const TINT = APP_TINTS.default.light;

export const OG_PALETTE = {
  /** The canvas behind the document page (`background-grouped`). */
  canvas: LIGHT["background-grouped"],
  /** The document page (`surface`). */
  paper: LIGHT.surface,
  /** Primary text (`label`). */
  ink: LIGHT.label,
  /** Secondary text (`label-secondary`). */
  inkSecondary: LIGHT["label-secondary"],
  /** Hairlines and the page edge (`separator-opaque`). */
  rule: LIGHT["separator-opaque"],
  /** The seal and portrait wells: opaque (`surface-secondary`), so the guilloché stays behind them. */
  well: LIGHT["surface-secondary"],
  /** The tint: guilloché and Lorewards rank on the passport card. */
  tint: TINT.tint,
  onTint: TINT.onTint,
  /** The Realms tint: the realm card's banner fallback and join pill. */
  realmTint: APP_TINTS.realms.light.tint,
  onRealmTint: APP_TINTS.realms.light.onTint,
} as const;

/** The guilloché's opacity on paper (the page draws it at 10%), and over the tint banner. */
export const OG_GUILLOCHE_OPACITY = { paper: 0.14, banner: 0.22 } as const;

/** Open Graph's large-image size. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** The family name the cards set; `loadOgFonts` registers Schibsted Grotesk under it. */
export const OG_FONT_FAMILY = "Schibsted Grotesk";
