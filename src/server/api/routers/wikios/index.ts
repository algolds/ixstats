/**
 * wikios router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.wikios.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - page-content:          article rendering, history, page metadata
 *  - search-categories:     search, advanced search, category tree, stats
 *  - templates:             template registry (search, data, preview, sync)
 *  - editing:               wikitext conversion, save, upload, rollback
 *  - stash:                 lore stash CRUD and item management
 *  - watchlist-annotations: user watchlist + page annotations
 *  - user-talk:             user info, contributions, talk pages, backlinks
 */
import { mergeRouters } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "./page-content";
import { wikiosHistoryDiffRouter } from "./history-diff";
import { wikiosSearchRouter } from "./search";
import { wikiosCategoriesRouter } from "./categories";
import { wikiosTemplatesRouter } from "./templates";
import { wikiosEditingRouter } from "./editing";
import { wikiosStashRouter } from "./stash";
import { wikiosWatchlistAnnotationsRouter } from "./watchlist-annotations";
import { wikiosUserTalkRouter } from "./user-talk";
import { wikiosDiscussionsRouter } from "./discussions";
import { wikiosUtilitiesRouter } from "./utilities";

export const wikiosRouter = mergeRouters(
  wikiosPageContentRouter,
  wikiosHistoryDiffRouter,
  wikiosSearchRouter,
  wikiosCategoriesRouter,
  wikiosTemplatesRouter,
  wikiosEditingRouter,
  wikiosStashRouter,
  wikiosWatchlistAnnotationsRouter,
  wikiosUserTalkRouter,
  wikiosDiscussionsRouter,
  wikiosUtilitiesRouter
);
