/**
 * Pure mappers from resolved identity rows to the passport's Realms and History payloads.
 */
import { DEFAULT_REALM_ID, IXWORLD_SLUG } from "~/lib/realms/realm-ids";
import { isAwardWinner, type LoreAwardRow } from "./identity.feed";
import type { IdentityCountry } from "./identity.selects";
import type {
  AwardHistoryItem,
  IdentityEventPayload,
  IdentityHistoryPage,
  RealmMembership,
  RealmRole,
  WikiActivityItem,
  WikiActivityType,
} from "./identity.types";

/** The realm a country belongs to; IxWorld is named even when its realm row is missing. */
function realmOf(country: IdentityCountry): { id: string; name: string; slug: string } {
  if (country.realm) return country.realm;
  if (country.realmId === DEFAULT_REALM_ID) {
    return { id: DEFAULT_REALM_ID, name: "IxWorld", slug: IXWORLD_SLUG };
  }
  return { id: country.realmId, name: country.realmId, slug: country.realmId };
}

function countrySlug(country: { slug: string | null; name: string }): string {
  return country.slug ?? country.name.toLowerCase().replace(/ /g, "_");
}

/** The primary nation: the linked `User.countryId` when it is held, else the highest-GDP held nation. */
export function primaryNationOf<T extends { id: string; currentTotalGdp: number }>(
  nations: readonly T[],
  linkedCountryId: string | null
): T | null {
  const linked = nations.find((n) => n.id === linkedCountryId);
  if (linked) return linked;
  return nations.reduce<T | null>(
    (best, n) => (best && best.currentTotalGdp >= n.currentTotalGdp ? best : n),
    null
  );
}

/** One row per held nation, with the holder's role in its realm (member unless founder or officer). */
export function toRealmMemberships(
  nations: IdentityCountry[],
  primaryCountryId: string | null,
  roles: ReadonlyMap<string, RealmRole>
): RealmMembership[] {
  return nations.map((c) => ({
    ...realmOf(c),
    role: roles.get(c.realmId) ?? "member",
    isPrimary: c.id === primaryCountryId,
    country: {
      id: c.id,
      name: c.name,
      slug: countrySlug(c),
      flagUrl: c.flag,
      coatOfArmsUrl: c.coatOfArms,
      currentPopulation: c.currentPopulation,
      currentTotalGdp: c.currentTotalGdp,
      currentGdpPerCapita: c.currentGdpPerCapita,
      continent: c.continent,
      region: c.region,
      governmentType: c.governmentType,
      currentPublicApproval: c.publicApproval,
    },
  }));
}

/** Memberships inside one realm, matched by slug or id (for `/r/[realm]/[username]`). */
export function filterByRealm(memberships: RealmMembership[], realm: string): RealmMembership[] {
  const key = realm.toLowerCase();
  return memberships.filter((m) => m.slug.toLowerCase() === key || m.id.toLowerCase() === key);
}

export function toAwardHistory(
  awards: LoreAwardRow[],
  wikiName: string | null
): AwardHistoryItem[] {
  return awards.map((award) => {
    const isWinner = isAwardWinner(award, wikiName);
    return {
      id: award.id,
      date: award.date,
      type: award.type,
      role: isWinner ? "winner" : "runner-up",
      page:
        (isWinner ? award.winnerPage : award.runnerUpPage) ||
        award.winnerPage ||
        award.runnerUpPage ||
        null,
      score:
        (isWinner ? award.winnerScore : award.runnerUpScore) ||
        award.winnerScore ||
        award.runnerUpScore ||
        null,
    };
  });
}

export interface DirectiveRow {
  id: string;
  goal: string;
  tier: string;
  category: string;
  status: string;
  countryId: string;
  createdAt: Date;
}

const WIKI_VERB: Record<WikiActivityType, string> = {
  publish: "Published",
  laurel: "Earned Laurel on",
  discussion: "Participated in",
  revision: "Edited",
  minor_edit: "Edited",
};

function wikiEventDescription(item: WikiActivityItem): string {
  if (item.summary) return item.summary;
  if (!item.byteDiff) return "WikiOS Contribution";
  return `${item.byteDiff > 0 ? `+${item.byteDiff}` : item.byteDiff} bytes`;
}

interface HistorySources {
  identityId: string;
  handle: string;
  feed: WikiActivityItem[];
  directives: DirectiveRow[];
  countryNames: ReadonlyMap<string, string>;
  joinedAt: Date | null;
}

/** The cross-platform History stream, newest first. */
export function buildHistoryEvents(sources: HistorySources): IdentityEventPayload[] {
  const { identityId, handle, feed, directives, countryNames, joinedAt } = sources;
  const events: IdentityEventPayload[] = feed.map((item) => ({
    id: `hist-${item.id}`,
    identityId,
    system: "wikios",
    type: item.type === "publish" ? "wikios.article_published" : "wikios.article_revised",
    title: `${WIKI_VERB[item.type]} "${item.title}"`,
    description: wikiEventDescription(item),
    timestamp: new Date(item.timestamp),
    objectUrl: item.url,
  }));

  for (const dir of directives) {
    events.push({
      id: `dir-${dir.id}`,
      identityId,
      countryId: dir.countryId,
      countryName: countryNames.get(dir.countryId),
      system: "mycountry",
      type: "mycountry.directive_enacted",
      title: `Enacted Directive: ${dir.goal}`,
      description: `Category: ${dir.category || "Governance"} · Tier: ${dir.tier} · Status: ${dir.status}`,
      timestamp: new Date(dir.createdAt),
      objectId: dir.id,
      objectUrl: "/mycountry",
    });
  }

  if (joinedAt) {
    events.push({
      id: "account-joined",
      identityId,
      system: "realm",
      type: "realm.joined",
      title: "Established IxStates Identity",
      description: "Registered canonical digital passport on IxStates",
      timestamp: new Date(joinedAt),
      objectUrl: `/@${handle}`,
    });
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Cursor = id of the last event already shown; an unknown cursor restarts from the top. */
export function paginateEvents(
  events: IdentityEventPayload[],
  limit: number,
  cursor: string | null | undefined
): IdentityHistoryPage {
  const start = cursor ? events.findIndex((e) => e.id === cursor) + 1 : 0;
  const items = events.slice(start, start + limit);
  const hasMore = start + limit < events.length;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}
