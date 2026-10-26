/**
 * The Discord bot's IxTime control commands (override, clear, pause, resume), sent by `IxTime` (./core).
 */

export interface BotCommandResult {
  success: boolean;
  message: string;
}

/** POST a control command to the bot: its message, or `failure` with the reason. */
export async function postBotCommand(
  url: string,
  failure: string,
  body?: Record<string, unknown>
): Promise<BotCommandResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Bot API returned ${response.status}`);
    }

    const result = await response.json();
    return { success: true, message: result.message };
  } catch (error) {
    return {
      success: false,
      message: `${failure}: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
