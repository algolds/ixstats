/** @jest-environment node */
/**
 * Plan 410: the real src/env.ts (not the jest mock) accepts any WIKIOS_API_SESSION_SECRET, short ones
 * included: validation never stops the app from starting over it. api.php refuses a short key at use
 * (session-secret.test.ts).
 */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5433/ixstats_test",
  CRON_SECRET: "c".repeat(40),
  WIKI_SYNC_WEBHOOK_SECRET: "w".repeat(40),
  // what production requires besides the secret under test
  IXTIME_BOT_SECRET: "i".repeat(40),
  CLERK_SECRET_KEY: "sk_test_" + "x".repeat(30),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_" + "x".repeat(30),
};

/** The invalid-variable names `src/env.ts` reports (it logs them and throws), or [] when it loads. */
async function invalidVariables(overrides: Record<string, string | undefined>, nodeEnv: string): Promise<string[]> {
  const saved = { ...process.env };
  const logged: unknown[][] = [];
  const spy = jest.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
  try {
    Object.assign(process.env, BASE_ENV, { NODE_ENV: nodeEnv, SKIP_ENV_VALIDATION: "" });
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    let failed = false;
    await jest.isolateModulesAsync(async () => {
      try {
        await import("../../../../env");
      } catch {
        failed = true;
      }
    });
    return failed ? [...JSON.stringify(logged).matchAll(/"path":\["([A-Za-z_]+)"/g)].map((match) => match[1]!) : [];
  } finally {
    spy.mockRestore();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

describe.each(["production", "test"])("src/env.ts in %s", (nodeEnv) => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["one character", "x"],
    ["31 characters", "k".repeat(31)],
    ["32 characters", "k".repeat(32)],
    ["a long one", "k".repeat(100)],
  ])("loads when WIKIOS_API_SESSION_SECRET is %s", async (_label, value) => {
    const failures = await invalidVariables({ WIKIOS_API_SESSION_SECRET: value }, nodeEnv);
    expect(failures.filter((name) => name.includes("WIKIOS_API_SESSION_SECRET"))).toEqual([]);
    expect(failures).toEqual([]);
  });
});
