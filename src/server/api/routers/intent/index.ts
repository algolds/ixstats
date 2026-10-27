/**
 * Intent router (design-bible v2, migration plan §1), split by domain and recombined here.
 *
 * The player-initiated twin of National Issues: state a goal → the government
 * proposes Measured/Moderate/Extreme packages → commit one → applied through the
 * CountryEventSpine (bounded stat change + ledger + news). mergeRouters keeps every
 * procedure at the top level, so `api.intent.*` is unchanged.
 *
 * Domains:
 *  - directives: suggest, status, commit, status transitions and the summation draft
 *  - record:     the decision tree, a directive's outcome and its linked issues
 */
import { mergeRouters } from "~/server/api/trpc";
import { intentDirectivesRouter } from "./directives";
import { intentRecordRouter } from "./record";

export const intentRouter = mergeRouters(intentDirectivesRouter, intentRecordRouter);
