/**
 * wikios router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.wikios.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - page-content:          article rendering, sections, images, infobox, page metadata
 *  - history-diff:          revision history, diffs, revision content
 *  - search:                search, advanced search, recent changes, random page, site stats
 *  - categories:            category members, parents, tree and autocomplete
 *  - templates:             template registry (search, data, preview)
 *  - editing:               preview, save, upload, revert, rollback, restore
 *  - stash:                 stash CRUD and item management
 *  - watchlist-annotations: user watchlist + page annotations
 *  - user-talk:             author profiles, user info, contributions, talk pages, backlinks
 *  - discussions:           Margin discussion threads and comments
 *  - utilities:             maintenance reports (orphans, dead ends, broken redirects) and audit logs
 *  - page-views:            page info, page lists, category member pages, file info (plan 412)
 *  - page-admin:            move, delete, undelete, protect, block, user groups, log
 *  - bot-passwords:         Special:BotPasswords (api.php credentials)
 *  - repository-files:      image repository file browser (paged wiki, forum and own-upload files)
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
import { wikiosPageViewsRouter } from "./page-views";
import { wikiosPageAdminRouter } from "./page-admin";
import { wikiosBotPasswordsRouter } from "./bot-passwords";
import { wikiosRepositoryFilesRouter } from "./repository-files";

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
  wikiosUtilitiesRouter,
  wikiosPageViewsRouter,
  wikiosPageAdminRouter,
  wikiosBotPasswordsRouter,
  wikiosRepositoryFilesRouter
);
