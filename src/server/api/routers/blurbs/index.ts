/**
 * Blurbs router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.blurbs.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - browse:   public gallery / discovery (active prompts, single prompt, responses, counts, random)
 *  - respond:  authenticated user actions (my blurbs, submit/edit own response, submit new prompt)
 *  - moderate: admin prompt lifecycle + featured flags (create/update prompts, feature response/prompt)
 */
import { mergeRouters } from "~/server/api/trpc";
import { blurbsBrowseRouter } from "./browse";
import { blurbsRespondRouter } from "./respond";
import { blurbsModerateRouter } from "./moderate";

export const blurbsRouter = mergeRouters(
  blurbsBrowseRouter,
  blurbsRespondRouter,
  blurbsModerateRouter
);
