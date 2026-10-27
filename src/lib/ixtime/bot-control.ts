/**
 * The Discord bot's IxTime control endpoints (override, clear, pause, resume). The bot is the
 * source of truth for IxTime; these ask it to change its clock and report its answer.
 */

export interface BotCommandResult {
  success: boolean;
  message: string;
}

/**
 * POST `${baseUrl}/ixtime/${command}` (5 s timeout) and return the bot's message, or a failure
 * naming `action` ("pause bot time") with the reason. Never throws.
 */
export async function postBotCommand(
  baseUrl: string | undefined,
  command: "override" | "clear" | "pause" | "resume",
  action: string,
  body?: { ixTimeMs: number; multiplier?: number }
): Promise<BotCommandResult> {
  try {
    const response = await fetch(`${baseUrl}/ixtime/${command}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Bot API returned ${response.status}`);
    }

    const result: { message: string } = await response.json();
    return { success: true, message: result.message };
  } catch (error) {
    return {
      success: false,
      message: `Failed to ${action}: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
