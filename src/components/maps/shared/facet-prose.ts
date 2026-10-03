/**
 * Typography-plugin (`prose`) colours bound to Facet roles, so rendered rich text follows the
 * theme and Increase Contrast with no per-theme prose inversion.
 * Used by the story-pin reader and the MyCountry dossier wiki sections.
 */
export const FACET_PROSE = [
  "prose max-w-none",
  "[--tw-prose-body:var(--color-label-secondary)]",
  "[--tw-prose-headings:var(--color-label)]",
  "[--tw-prose-lead:var(--color-label-secondary)]",
  "[--tw-prose-links:var(--color-tint)]",
  "[--tw-prose-bold:var(--color-label)]",
  "[--tw-prose-counters:var(--color-label-secondary)]",
  "[--tw-prose-bullets:var(--color-label-tertiary)]",
  "[--tw-prose-hr:var(--color-separator)]",
  "[--tw-prose-quotes:var(--color-label)]",
  "[--tw-prose-quote-borders:var(--color-separator)]",
  "[--tw-prose-captions:var(--color-label-secondary)]",
  "[--tw-prose-code:var(--color-label)]",
  "[--tw-prose-th-borders:var(--color-separator)]",
  "[--tw-prose-td-borders:var(--color-separator)]",
].join(" ");
