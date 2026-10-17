/**
 * The Discord bot's Lorewards endpoints (`IXTIME_BOT_URL`): the blacklist, and the override both override procedures
 * tell it of (`lorewards.overrideWinner`, `admin.saveLorewardWinnerOverride`).
 */

/** How long the bot has to answer: an override is saved before it is told, so a stalled bot must not hold the admin. */
const BOT_TIMEOUT_MS = 10_000;

/** POSTs to the Discord bot; `failure` prefixes the error raised when the bot or the call fails. */
export async function postToBot<T>(
  path: string,
  body: object,
  failure: string,
  onOk: (res: Response) => T | Promise<T>
): Promise<T> {
  const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${botUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Bot returned status ${res.status}`);
    }
    return await onOk(res);
  } catch (err) {
    throw new Error(`${failure}: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }
}

/**
 * Tells the bot what an overridden contest now holds. Whether it took it: the override is already saved, so a bot
 * that is down or refuses is logged, never thrown, and picks the change up on its next sync.
 */
export async function tellBotOfOverride(override: object): Promise<boolean> {
  try {
    await postToBot(
      "/lorewards/override",
      override,
      "Failed to sync override with Discord bot",
      () => undefined
    );
    return true;
  } catch (error) {
    console.error("[Lorewards] The override is saved, but the Discord bot was not told:", error);
    return false;
  }
}
