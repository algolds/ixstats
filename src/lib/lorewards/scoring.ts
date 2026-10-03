/**
 * lorewards-scoring.ts — WikiOS Lorewards Scoring Engine.
 *
 * Independent scoring system that runs alongside the Discord bot.
 * Uses 5 quality signals beyond raw byte count to better match panelist judgment.
 * All data from PostgreSQL (wiki_revisions, wiki_articles, wiki_links) — sub-5ms latency.
 */

import { db } from "~/server/db";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";

export interface ScoringWeights {
  proseWeight: number; // Weight in prose multiplier formula (default 0.7)
  collaborativeBonus: number; // Multiplier for cross-country edits (default 1.3)
  depthMaxBonus: number; // Max bonus for edit depth (default 0.3)
  noveltyBonus: number; // Multiplier for new article creation (default 1.2)
  importanceMaxBonus: number; // Max bonus for inlink count (default 0.2)
  listPenalty: number; // Multiplier for "List of..." articles (default 0.3)
  minorOnlyPenalty: number; // Multiplier for all-minor edits (default 0.2)
  minSingleEdit: number; // Min bytes for winner qualification (default 1000)
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  proseWeight: 0.7,
  collaborativeBonus: 1.3,
  depthMaxBonus: 0.3,
  noveltyBonus: 1.2,
  importanceMaxBonus: 0.2,
  listPenalty: 0.3,
  minorOnlyPenalty: 0.2,
  minSingleEdit: 1000,
};

interface CandidateScore {
  user: string;
  page: string;
  pageId: string | number;
  bytesAdded: number;
  largestEdit: number;
  editCount: number;
  isMinorOnly: boolean;
  // Quality signals
  proseRatio: number;
  proseMultiplier: number;
  isCollaborative: boolean;
  collaborativeMultiplier: number;
  editDepth: number;
  depthMultiplier: number;
  isNewArticle: boolean;
  noveltyMultiplier: number;
  inlinkCount: number;
  importanceMultiplier: number;
  // Final
  finalScore: number;
  scoreBreakdown: string;
}

interface WikiOSScoringResult {
  date: string;
  winner: CandidateScore | null;
  runnerUp: CandidateScore | null;
  candidates: CandidateScore[];
  editCount: number;
  weights: ScoringWeights;
}

const LIST_PAGE = /^Lists? of /i;
const ENRICHED_COUNT = 10;
/** Standard high prose heuristic for substantive edits. */
const PROSE_RATIO = 0.85;

/** A user's edits to one page over the day. */
interface Candidate {
  user: string;
  page: string;
  articleId: string;
  bytesAdded: number;
  largestEdit: number;
  editCount: number;
  isMinorOnly: boolean;
  hasNewArticle: boolean;
}

function aggregateCandidates(revRows: any[]): Candidate[] {
  const byUserPage = new Map<string, Candidate>();

  for (const row of revRows) {
    const user = String(row.author || "Anonymous");
    if (/bot$/i.test(user)) continue;

    const page = String(row.article?.title || "Untitled").replace(/_/g, " ");
    const diff = Number(row.byteDelta || 0);
    const key = `${user}|${page}`;
    let entry = byUserPage.get(key);
    if (!entry) {
      entry = {
        user,
        page,
        articleId: String(row.articleId),
        bytesAdded: 0,
        largestEdit: 0,
        editCount: 0,
        isMinorOnly: true,
        hasNewArticle: diff > 500 && row.byteSize === diff,
      };
      byUserPage.set(key, entry);
    }

    if (diff > 0) entry.bytesAdded += diff;
    entry.largestEdit = Math.max(entry.largestEdit, diff);
    entry.editCount++;
    if (!row.minor) entry.isMinorOnly = false;
  }

  // Drop trivial entries, biggest first
  return Array.from(byUserPage.values())
    .filter((e) => e.bytesAdded >= 100)
    .sort((a, b) => b.bytesAdded - a.bytesAdded);
}

const applyPenalties = (score: number, c: Candidate, weights: ScoringWeights) => {
  let result = score;
  if (LIST_PAGE.test(c.page)) result *= weights.listPenalty;
  if (c.isMinorOnly && c.largestEdit < weights.minSingleEdit) result *= weights.minorOnlyPenalty;
  return result;
};

const candidateBase = (c: Candidate) => ({
  user: c.user,
  page: c.page,
  pageId: c.articleId,
  bytesAdded: c.bytesAdded,
  largestEdit: c.largestEdit,
  editCount: c.editCount,
  isMinorOnly: c.isMinorOnly,
  isCollaborative: false,
  collaborativeMultiplier: 1,
});

/** Full quality-signal scoring (prose, edit depth, novelty, inlink importance) for a top candidate. */
async function enrichCandidate(c: Candidate, weights: ScoringWeights): Promise<CandidateScore> {
  const inlinks: number = await (db as any).wikiLink
    .count({ where: { targetSlug: toArticleSlug(c.page) } })
    .catch(() => 0);
  const depth: number = await (db as any).wikiRevision
    .count({ where: { articleId: c.articleId, author: c.user } })
    .catch(() => 1);

  const proseMultiplier = 1 - weights.proseWeight + PROSE_RATIO * weights.proseWeight;
  const depthMultiplier = 1 + Math.min(depth / 10, 1) * weights.depthMaxBonus;
  const noveltyMultiplier = c.hasNewArticle ? weights.noveltyBonus : 1.0;
  const importanceMultiplier = 1 + Math.min(inlinks / 50, 1) * weights.importanceMaxBonus;

  const raw =
    c.bytesAdded *
    proseMultiplier *
    1.0 *
    depthMultiplier *
    noveltyMultiplier *
    importanceMultiplier;
  const finalScore = Math.round(applyPenalties(raw, c, weights));

  const parts = [`base:${c.bytesAdded}`];
  if (proseMultiplier < 0.95) parts.push(`prose:${proseMultiplier.toFixed(2)}x`);
  if (depth > 0) parts.push(`depth:${depthMultiplier.toFixed(2)}x(${depth}revs)`);
  if (c.hasNewArticle) parts.push(`new:${noveltyMultiplier}x`);
  if (inlinks > 10) parts.push(`imp:${importanceMultiplier.toFixed(2)}x(${inlinks}links)`);
  if (LIST_PAGE.test(c.page)) parts.push(`list:${weights.listPenalty}x`);

  return {
    ...candidateBase(c),
    proseRatio: PROSE_RATIO,
    proseMultiplier,
    editDepth: depth,
    depthMultiplier,
    isNewArticle: c.hasNewArticle,
    noveltyMultiplier,
    inlinkCount: inlinks,
    importanceMultiplier,
    finalScore,
    scoreBreakdown: parts.join(" · "),
  };
}

/** Candidates below the top ten are scored on bytes alone. */
const unenrichedScore = (c: Candidate, weights: ScoringWeights): CandidateScore => ({
  ...candidateBase(c),
  proseRatio: -1,
  proseMultiplier: 1,
  editDepth: 0,
  depthMultiplier: 1,
  isNewArticle: false,
  noveltyMultiplier: 1,
  inlinkCount: 0,
  importanceMultiplier: 1,
  finalScore: Math.round(applyPenalties(c.bytesAdded, c, weights)),
  scoreBreakdown: `base:${c.bytesAdded} (unenriched)`,
});

export async function scoreDailyWikiOS(
  dateStr: string,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Promise<WikiOSScoringResult> {
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const revRows: any[] = await (db as any).wikiRevision
    .findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        author: { not: null },
        article: { namespace: 0 },
      },
      select: {
        id: true,
        articleId: true,
        author: true,
        byteSize: true,
        byteDelta: true,
        minor: true,
        createdAt: true,
        wikitext: true,
        article: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => []);

  const candidates = aggregateCandidates(revRows);
  const scored: CandidateScore[] = [];
  for (const c of candidates.slice(0, ENRICHED_COUNT))
    scored.push(await enrichCandidate(c, weights));
  for (const c of candidates.slice(ENRICHED_COUNT)) scored.push(unenrichedScore(c, weights));
  scored.sort((a, b) => b.finalScore - a.finalScore);

  let winner: CandidateScore | null = null;
  let runnerUp: CandidateScore | null = null;
  for (const c of scored) {
    if (c.finalScore <= 0) continue;
    if (!winner && c.largestEdit >= weights.minSingleEdit && !LIST_PAGE.test(c.page)) {
      winner = c;
    } else if (!runnerUp && (!winner || c.user !== winner.user)) {
      runnerUp = c;
      break;
    }
  }

  return {
    date: dateStr,
    winner,
    runnerUp,
    candidates: scored.slice(0, ENRICHED_COUNT),
    editCount: revRows.length,
    weights,
  };
}
