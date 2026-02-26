/**
 * Demo Seed module - re-exports for backward compatibility.
 *
 * External consumers should import from this index:
 *   import { DemoSeedService } from "~/lib/demo-seed";
 */

export { DemoSeedService } from "./demo-seed-service";
export type { SeedStats } from "./types";
export { emptySeedStats, computeTotal } from "./types";
