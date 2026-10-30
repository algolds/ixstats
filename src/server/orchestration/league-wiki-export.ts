/**
 * "Publish to wiki" (MyLeague): a league's standings written into the marked standings block of its IxWiki article.
 *
 * The save is the WikiOS editor's own path (`saveWikitext`): signed in as the caller, through their edit rights,
 * never a bot account. Only the block between the markers changes (`spliceStandings`), and the save is based on the
 * head revision read before the text, so an edit that lands meanwhile is answered as a conflict, never overwritten.
 *
 * The caller has already checked that the user manages the league (`sports.publishStandingsToWiki`).
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { displayedSeason } from "~/lib/sports/displayed-season";
import {
  StandingsMarkerError,
  spliceStandings,
  standingsWikitext,
  type StandingRow,
} from "~/lib/sports/standings-wikitext";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { parseRedirect } from "~/lib/wiki-os/core/redirect";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";
import { assertCanEditArticle, saveOrConflict } from "~/lib/wiki-os/services/edit-service";
import { getSeasonStandings, type StandingsDb } from "~/server/modules/sports/standings";

export interface PublishStandingsContext extends WikiAuthContext {
  db: Pick<PrismaClient, "sportLeague"> & StandingsDb;
}

export type PublishStandingsResult =
  { success: true; revisionRef: string } | { success: false; conflict: true };

const precondition = (message: string) => new TRPCError({ code: "PRECONDITION_FAILED", message });

async function loadLeague(db: PublishStandingsContext["db"], leagueId: string) {
  const league = await db.sportLeague.findUnique({
    where: { id: leagueId },
    select: {
      name: true,
      wikiSlug: true,
      seasons: {
        select: { id: true, seasonNumber: true, status: true },
        orderBy: { seasonNumber: "desc" },
      },
    },
  });
  if (!league) throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
  if (!league.wikiSlug) {
    throw precondition("Link a wiki article to this league before publishing its standings.");
  }
  return { ...league, wikiSlug: league.wikiSlug };
}

/** The canonical title of the league's article. Refuses a slug that is no title or names a page outside the main namespace. */
function articleTitle(wikiSlug: string): string {
  const canon = canonicalizeTitle(wikiSlug);
  if (canon?.namespaceId !== 0) {
    throw precondition(
      "The league's wiki article must be a regular article, not a template, user, category or other special page. Nothing was saved."
    );
  }
  return canon.title;
}

/** The standings the league page shows (its displayed season), as table rows. Refuses a league with none yet. */
async function loadStandings(
  db: StandingsDb,
  seasons: { id: string; seasonNumber: number; status: string }[]
): Promise<{ seasonNumber: number; rows: StandingRow[] }> {
  const season = displayedSeason(seasons);
  const standings = season ? await getSeasonStandings(db, season.id) : [];
  if (!season || standings.length === 0) {
    throw precondition("This league has no standings to publish yet.");
  }
  const rows = standings.map((s) => ({
    position: s.position,
    teamName: s.team.name,
    wikiSlug: s.team.wikiSlug,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    points: s.points,
  }));
  return { seasonNumber: season.seasonNumber, rows };
}

/**
 * The article's text and the head revision it is at, read as `wikios.getWikitext` reads them: the head FIRST, so a
 * save in between can only make the text newer than its ref (a harmless conflict), never older. Without a head (no
 * page, or the shadow store cannot be read) the save would have no base and could overwrite an edit, so it refuses.
 * A redirect page is refused too: the standings belong on the article it points to.
 */
async function readArticleAtHead(ctx: WikiAuthContext, title: string) {
  await assertTitleVisible(ctx, title, "ixwiki");
  const head = await getHeadRevisionRefs(title).catch(() => null);
  if (!head) {
    throw precondition(
      "The league's wiki article could not be read at its latest revision, so publishing could overwrite someone's edit. Nothing was saved."
    );
  }
  const page = await getArticleWikitextShadow(title, "ixwiki", { includeArchived: true });
  if (!page) {
    throw precondition(
      "The league's wiki article has no text to add the standings to yet. Nothing was saved."
    );
  }
  const redirect = parseRedirect(page.wikitext);
  if (redirect) {
    throw precondition(
      `The league's wiki article redirects to ${redirect.title}. Link the league to that article instead. Nothing was saved.`
    );
  }
  return { wikitext: page.wikitext, headRef: head.revisionRef };
}

function spliceOrRefuse(article: string, block: string): string {
  try {
    return spliceStandings(article, block);
  } catch (error) {
    if (error instanceof StandingsMarkerError) {
      throw precondition(
        "The article's standings block has a start marker but no end marker. Fix the markers on the wiki and try again."
      );
    }
    throw error;
  }
}

/** Write the league's standings into its wiki article as the signed-in caller. */
export async function publishLeagueStandings(
  ctx: PublishStandingsContext,
  leagueId: string
): Promise<PublishStandingsResult> {
  const league = await loadLeague(ctx.db, leagueId);
  const title = articleTitle(league.wikiSlug);
  await assertCanEditArticle(ctx, title);

  const { seasonNumber, rows } = await loadStandings(ctx.db, league.seasons);
  const asOf = `season ${seasonNumber}, ${IxTime.formatIxTime(IxTime.getCurrentIxTime())}`;
  const article = await readArticleAtHead(ctx, title);
  const wikitext = spliceOrRefuse(article.wikitext, standingsWikitext(league, rows, asOf));

  const outcome = await saveOrConflict(ctx, {
    title,
    wikitext,
    summary: `Standings from IxStates (${league.name})`,
    minor: false,
    expectedHeadRef: article.headRef,
  });
  return outcome.success
    ? { success: true, revisionRef: outcome.revisionId }
    : { success: false, conflict: true };
}
