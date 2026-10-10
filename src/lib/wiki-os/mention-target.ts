/**
 * What an entity mention links to (league, club, country, persona profile) and which profile its hover card may
 * load. Pure, so the hover card's query guard is tested on its own (U9).
 */

/** The kind of entity a mention's href points at. */
export function entityKinds(href: string) {
  return {
    isLeague: href.includes("/myleague/"),
    isClub: href.includes("/myclub/"),
    isCountry: href.includes("/countries/"),
    // Persona profiles: the current path and the old ThinkPages one that existing wiki pages still link.
    isUser: href.includes("/dashboard/profile/") || href.includes("/thinkpages/profile/"),
  };
}

const ENTITY_ID =
  /\/(?:myleague|myclub|countries|dashboard\/profile|thinkpages\/profile|thinkpages\/u|u)\/([a-zA-Z0-9_-]+)/;

/**
 * The entity id in `href` and which lookup to run: only once the card is `open`, and never for an empty id (a slug
 * the pattern cannot read), so no query runs with an empty name.
 */
export function mentionQueries(open: boolean, href: string) {
  const entityId = ENTITY_ID.exec(href)?.[1] ?? "";
  const { isLeague, isClub, isCountry, isUser } = entityKinds(href);
  const ready = open && entityId !== "";
  return {
    entityId,
    league: ready && isLeague,
    club: ready && isClub,
    country: ready && isCountry,
    user: ready && isUser,
  };
}
