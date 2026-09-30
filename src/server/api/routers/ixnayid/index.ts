import { mergeRouters } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "./core";
import { ixnayidLinkingRouter } from "./linking";
import { ixnayidPassportRouter } from "./passport";

export const ixnayidRouter = mergeRouters(
  ixnayidCoreRouter,
  ixnayidLinkingRouter,
  ixnayidPassportRouter
);
