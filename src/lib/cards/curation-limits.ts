/**
 * The most cards one filter review (the curation queue's approve all) may change. Above it the admin narrows the
 * filter, so no single click sends an unbounded set of cards into packs. Client-safe: the queue disables the button.
 */
export const MAX_FILTER_REVIEW = 1000;
