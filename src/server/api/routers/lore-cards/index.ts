/**
 * Lore Cards router: the wiki-backed lore card procedures, at `api.loreCards.*`.
 *
 * Players suggest lore cards for free through `api.cards.suggestCard`; admins answer them in the cards admin's
 * Curation tab (`api.cards.admin.curation.*`).
 */
export { loreCardsWikiRouter as loreCardsRouter } from "./wiki";
