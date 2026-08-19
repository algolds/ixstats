/**
 * Onoma router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.onoma.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - namebank:    name bank CRUD, Stash item sync, public dictionary catalog, training data
 *  - speech:      speech config, Kokoro natural voice admin & health, branding config
 *  - history:     generation event logging, timeline, favorites, stats
 *  - batch:       batch generation jobs & matrix permutations
 *  - marketplace: language pack discovery, rating, and forking
 *  - etymology:   etymological graph links & root trees
 *  - syntax:      sentence structure, POS, and grammar trees
 *  - writing:     grapheme-to-glyph systems and script converters
 *  - loanwords:   cross-cultural loanword adaptation
 */
import { mergeRouters } from "~/server/api/trpc";
import { onomaNameBankRouter } from "./namebank";
import { onomaSpeechRouter } from "./speech";
import { onomaHistoryRouter } from "./history";
import { onomaBatchRouter } from "./batch";
import { onomaMarketplaceRouter } from "./marketplace";
import { onomaEtymologyRouter } from "./etymology";
import { onomaSyntaxRouter } from "./syntax";
import { onomaWritingRouter } from "./writing";
import { onomaLoanwordsRouter } from "./loanwords";

export const onomaRouter = mergeRouters(
  onomaNameBankRouter,
  onomaSpeechRouter,
  onomaHistoryRouter,
  onomaBatchRouter,
  onomaMarketplaceRouter,
  onomaEtymologyRouter,
  onomaSyntaxRouter,
  onomaWritingRouter,
  onomaLoanwordsRouter
);
