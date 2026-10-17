/** The most pages one card import job takes. Client-safe, like the curation cap it sets. */
export const MAX_IMPORT_TITLES = 2000;

/**
 * The most cards one filter review (the curation queue's approve all) may change: one import job's worth, so the
 * cards a whole job staged can always be approved at once. Above it the admin narrows the filter, so no single click
 * sends an unbounded set of cards into packs. The queue disables the button past it. The Library's bulk hide shares
 * it: one click hides or unhides at most this many cards.
 */
export const MAX_FILTER_REVIEW = MAX_IMPORT_TITLES;
