/**
 * Synthetic seed fallbacks for the Demo Seed system.
 *
 * These generate demo data when the source country has no records for a subsystem.
 * Static template records and tables are ingested from data/seed/*.json (Plan 176).
 * Domain seeders are organized under ./domains/.
 */

export * from "./domains/seed-government";
export * from "./domains/seed-policies";
export * from "./domains/seed-structure";
export * from "./domains/seed-security";
export * from "./domains/seed-economy";
export * from "./domains/seed-social-geo";
