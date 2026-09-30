/**
 * Colour on the MyCountry overview only ever carries meaning (Facet §11): destructive for a
 * critical item, orange for a warning, the MyCountry gold for directives, and nothing for the
 * rest. Domains are told apart by their glyph and label, never by a per-domain palette.
 */
export type StatusTone = "critical" | "warning" | "accent" | "neutral";

/** Text colour for a status label or glyph. */
export const STATUS_TEXT: Record<StatusTone, string> = {
  critical: "text-destructive",
  warning: "text-orange-600",
  accent: "text-(--facet-mycountry)",
  neutral: "text-muted-foreground",
};

/**
 * The one MyCountry-gold filled action per surface (Declare Directive in the header). Applied as
 * a className on `<Button>`, never as a bespoke button.
 */
export const MYCOUNTRY_PRIMARY_ACTION =
  "bg-amber-500 font-semibold text-amber-950 shadow-sm hover:bg-amber-400";
