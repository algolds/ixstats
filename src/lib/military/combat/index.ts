/**
 * Combat resolution (realm time design §4.1; research §7.5–7.6): map theatre, effective power and odds, intelligence
 * ranges, seeded resolution with losses and breakpoints, and the campaign preview. Pure and client-safe; the seed,
 * persistence and loading live in `src/server/modules/combat`.
 */
export * from "./constants";
export * from "./odds";
export * from "./theatre";
export * from "./power";
export * from "./surprise";
export * from "./rng";
export * from "./resolve";
export * from "./intel";
export * from "./preview";
export * from "./operations";
