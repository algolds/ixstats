/** @jest-environment node */
/**
 * The action-link rewards migration: hand-written, additive and idempotent, so the controller can apply it (and
 * re-apply it) to the clone and dev databases and the owner to production.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261017120000_action_link_rewards";
const sql = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8");
const schema = readFileSync("prisma/schema/post-links.prisma", "utf8");
const social = readFileSync("prisma/schema/social.prisma", "utf8");
const statements = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

const modelBody = (source: string, name: string): string =>
  source.match(new RegExp(`model ${name} \\{([^}]*)\\}`))?.[1] ?? "";

describe("action link rewards migration", () => {
  it("sorts after the forum engagement migration and after the reactions migration", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dirs.indexOf(DIR)).toBeGreaterThan(
      dirs.indexOf("20261015120000_thinkpages_forum_engagement")
    );
    const reactions = dirs.indexOf("20261016120000_thinkpages_forum_reactions");
    expect(reactions).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(reactions);
  });

  it("creates the reward table keyed by the activity, only when it is missing", () => {
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS "forum_action_rewards"');
    expect(statements.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(statements).toContain('"activityId" TEXT NOT NULL');
    expect(statements).toContain('"countryId" TEXT NOT NULL');
    expect(statements).toContain('"userId" TEXT NOT NULL');
    expect(statements).toContain('"amount" DOUBLE PRECISION NOT NULL');
    expect(statements).toContain('"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
    expect(statements).toContain(
      'CONSTRAINT "forum_action_rewards_pkey" PRIMARY KEY ("activityId")'
    );
  });

  it("indexes the daily cap count by country and day, only when missing", () => {
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS "forum_action_rewards_countryId_createdAt_idx" ON "forum_action_rewards"("countryId", "createdAt")'
    );
    expect(statements.match(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/g) ?? []).toEqual([]);
  });

  it("adds the activity foreign key behind a catalogue check, cascading", () => {
    expect(statements).toContain("conname = 'forum_action_rewards_activityId_fkey'");
    expect(statements).toContain(
      'REFERENCES "ActivityFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
  });

  it("leaves post_action_links and every other table alone", () => {
    expect(statements).not.toContain("post_action_links");
    expect(statements).not.toContain("rewardedAt");
    expect(statements.match(/ALTER TABLE "[A-Za-z_]+"/g)).toHaveLength(1);
    expect(statements).toContain('ALTER TABLE "forum_action_rewards" ADD CONSTRAINT');
    expect(statements).not.toMatch(/\b(?:DROP|TRUNCATE|INSERT)\b|(?<!ON )\b(?:UPDATE|DELETE)\b/);
  });

  it("is mirrored in the Prisma model, so a db push drops nothing", () => {
    const body = modelBody(schema, "ForumActionReward");
    expect(body).toMatch(/activityId\s+String\s+@id/);
    expect(body).toMatch(/countryId\s+String/);
    expect(body).toMatch(/userId\s+String/);
    expect(body).toMatch(/amount\s+Float/);
    expect(body).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(body).toContain("@@index([countryId, createdAt])");
    expect(body).toContain('@@map("forum_action_rewards")');
    expect(body).toContain("onDelete: Cascade");
  });

  it("gives the activity its back relation and leaves PostActionLink unchanged", () => {
    expect(social).toMatch(/forumActionReward\s+ForumActionReward\?/);
    expect(modelBody(schema, "PostActionLink")).not.toContain("rewardedAt");
  });
});
