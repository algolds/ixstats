import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");

/** Modules deleted when IxCredits stopped reading or rewarding country play, and the Exchange conversion was cut. */
const REMOVED_FILES = [
  "src/lib/vault/vault-passive-income.ts",
  "src/lib/vault/dividend-nation.ts",
  "src/lib/economy/budget-vault-calculator.ts",
  "src/lib/economy/passive-income-distribution-cron.ts",
  "src/lib/exchange/conversion.ts",
  "src/lib/exchange/quote.ts",
  "src/lib/action-rewards.ts",
  "src/server/modules/action-links/rewards.ts",
  "src/server/modules/thinkpages-forum/action-reward.ts",
  "src/components/thinkpages-forum/composer/RewardSignal.tsx",
  "src/components/vault/sections/dashboard/VaultYieldProjectionsCard.tsx",
  "src/components/vault/sections/VaultExchangeSection.tsx",
  "src/components/vault/sections/exchange",
];

/** Names that must no longer appear in any source file. */
const REMOVED_NAMES = [
  /vault-passive-income/,
  /dividend-nation/,
  /budget-vault-calculator/,
  /passive-income-distribution-cron/,
  /\b(?:catchUpPassiveIncome|calculatePassiveIncome|getBudgetMultiplier|resolveDividendCountryId)\b/,
  /\bdividendCountryId\b/,
  /lib\/exchange\/(?:conversion|quote)\b/,
  /\b(?:quoteConversion|convertOutAllowance|convertibleContractRevenue)\b/,
  /lib\/action-rewards/,
  /\b(?:grantActionLinkRewards|rewardNewLinks|RewardSignal|useRewardLine)\b/,
  /\b(?:VaultYieldProjectionsCard|VaultExchangeSection)\b/,
  /vault\/sections\/exchange/,
  /\b(?:grantOnboardingBonuses|awardPostCredits|awardScenarioCredits)\b/,
];

/** Country-play code that must never touch the IxCredits ledger. */
const NO_LEDGER_WRITES = [
  "src/server/api/routers/diplomaticScenarios/choices.ts",
  "src/server/api/routers/diplomacy/embassies/establish.ts",
  "src/server/api/routers/diplomacy/cultural/exchanges/core/mutations.ts",
  "src/server/api/routers/thinkpages/posts/posts/create.ts",
  "src/server/api/routers/countries/management/create.ts",
  "src/server/api/routers/realms/index.ts",
  "src/server/modules/thinkpages-forum/writes.ts",
  "src/server/modules/thinkpages-forum/board-writes.ts",
  "src/lib/lorewards/card-value-cron.ts",
  "src/lib/exchange/queries.ts",
];
const LEDGER_USE =
  /vaultService|earnCredits|spendCredits|grantBonus|vaultTransaction|creditsEarned/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** The two tests that name the removed functions in order to assert they are gone. */
const NAMING_TESTS = ["vault-country-inputs-removed.test.ts", "vault-no-country-earnings.test.ts"];
const sources = walk(path.join(ROOT, "src")).filter(
  (file) => !NAMING_TESTS.some((name) => file.endsWith(name))
);

describe("country inputs to IxCredits are gone", () => {
  it.each(REMOVED_FILES)("%s does not exist", (file) => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
  });

  it("no source file or test names a removed module or function", () => {
    const hits = sources.flatMap((file) => {
      const text = fs.readFileSync(file, "utf8");
      return REMOVED_NAMES.filter((name) => name.test(text)).map(
        (name) => `${path.relative(ROOT, file)}: ${name}`
      );
    });
    expect(hits).toEqual([]);
  });

  it.each(NO_LEDGER_WRITES)("%s never touches the IxCredits ledger", (file) => {
    expect(fs.readFileSync(path.join(ROOT, file), "utf8")).not.toMatch(LEDGER_USE);
  });

  it("registers no passive-income cron job", () => {
    const jobs = fs.readFileSync(path.join(ROOT, "src/server/cron/jobs.ts"), "utf8");
    expect(jobs).not.toMatch(/passive-income|passiveIncome/);
  });

  it("keeps the enum values and labels that old ledger rows still carry", () => {
    const labels = fs.readFileSync(path.join(ROOT, "src/lib/vault/activity-labels.ts"), "utf8");
    expect(labels).toContain("EXCHANGE_CONVERT_IN");
    expect(labels).toContain("SOCIAL_POST");
    const enums = fs.readFileSync(path.join(ROOT, "prisma/schema/enums.prisma"), "utf8");
    expect(enums).toContain("SPEND_EXCHANGE");
    expect(enums).toContain("EARN_EXCHANGE");
  });
});
