/**
 * The defense model (realm time design §4; research §7 layers a–d). Pure and client-safe; persistence and loading
 * live in `src/server/modules/defense`.
 */
export * from "./constants";
export * from "./types";
export * from "./budget";
export * from "./personnel";
export * from "./capital";
export * from "./readiness";
export * from "./power";
export * from "./tick";
export * from "./derive";
export * from "./starter";
export * from "./npc";
