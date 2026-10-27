/** frontPage: the signed-out front page at `/`. Logic lives in ~/server/modules/realms/realms.front-page. */
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import { getFrontPage } from "~/server/modules/realms/realms.front-page";

export const frontPageRouter = createTRPCRouter({
  get: cachedPublicProcedure.query(({ ctx }) => getFrontPage(ctx.db)),
});
