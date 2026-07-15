import { mergeRouters } from "~/server/api/trpc";
import { heraldryQueriesRouter } from "./queries";
import { heraldryMutationsRouter } from "./mutations";

export const heraldryRouter = mergeRouters(heraldryQueriesRouter, heraldryMutationsRouter);
