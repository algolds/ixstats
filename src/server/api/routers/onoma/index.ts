/**
 * Onoma router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.onoma.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - core:    name bank CRUD, speech config, Kokoro admin, brand config
 *  - history: generation event logging, timeline, favorites, stats
 */
import { mergeRouters } from "~/server/api/trpc";
import { onomaCoreRouter } from "./core";
import { onomaHistoryRouter } from "./history";
import { onomaBatchRouter } from "./batch";
import { onomaMarketplaceRouter } from "./marketplace";
import { onomaEtymologyRouter } from "./etymology";
import { onomaSyntaxRouter } from "./syntax";
import { onomaWritingRouter } from "./writing";
import { onomaLoanwordsRouter } from "./loanwords";

export const onomaRouter = mergeRouters(
  onomaCoreRouter,
  onomaHistoryRouter,
  onomaBatchRouter,
  onomaMarketplaceRouter,
  onomaEtymologyRouter,
  onomaSyntaxRouter,
  onomaWritingRouter,
  onomaLoanwordsRouter
);
