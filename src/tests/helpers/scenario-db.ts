/**
 * Real-Postgres scenario tests: they run only when SCENARIOS_DATABASE_URL names a database whose name ends in
 * `_scenarios` (a schema-only scratch database, never one holding data), and are skipped otherwise.
 *
 * Each test writes its own rows under a fresh `prefix()` and deletes them afterwards, so runs never see each other.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const url = process.env.SCENARIOS_DATABASE_URL;
const scratch = url !== undefined && /\/[^/?]*_scenarios(\?|$)/.test(url);
if (url && !scratch) throw new Error("SCENARIOS_DATABASE_URL must name a *_scenarios scratch database");

/** `describe` when a scratch database is configured, `describe.skip` otherwise. */
export const describeWithDb = scratch ? describe : describe.skip;

/** A client on the scratch database; call only inside `describeWithDb`. */
export const scenarioDb = (): PrismaClient => new PrismaClient({ datasourceUrl: url });

/** A unique id prefix for one test's rows. */
export const prefix = (): string => `scn-${randomUUID().slice(0, 8)}-`;
