/**
 * Geo Editor Linkage Router — split across domain subrouters and recombined here via mergeRouters.
 */
import { mergeRouters } from "~/server/api/trpc";
import { geoEditorLinkageAssignmentRouter } from "./assignment";
import { geoEditorLinkageValidationRouter } from "./validation";

export const geoEditorLinkageRouter = mergeRouters(
  geoEditorLinkageAssignmentRouter,
  geoEditorLinkageValidationRouter
);
