/** Atlas (spec docs/specs/2026-10-12-atlas-studio-design.md): the admin home for every realm's map and World Studio. */
import { createTRPCRouter } from "~/server/api/trpc";
import { atlasHealthRouter } from "./health";
import { atlasJobsRouter } from "./jobs";
import { atlasPresetsRouter } from "./presets";
import { atlasRealmsRouter } from "./realms";
import { atlasStudioRouter } from "./studio";

export const atlasRouter = createTRPCRouter({
  studio: atlasStudioRouter,
  presets: atlasPresetsRouter,
  jobs: atlasJobsRouter,
  realms: atlasRealmsRouter,
  health: atlasHealthRouter,
});
