const DISCORD_API = "https://discord.com/api/v10";

export interface DiscordMember {
  id: string;
  username: string;
  nick?: string;
  globalName?: string;
}

export interface DiscordSuggestion {
  discordUserId: string;
  discordUsername: string;
  discordNick?: string;
  discordAvatar?: string;
  matchedUserId: string;
  matchedUserClerkId: string;
  matchedCountryName: string;
  confidence: "HIGH" | "MEDIUM";
  reason: string;
}

interface DiscordUser {
  id: string | number;
  username?: string;
  global_name?: string | null;
  bot?: boolean;
}

/** GET against the Discord API as the bot; null on any failure, so every step can fall back. */
async function discordGet<T>(path: string, botToken: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(`${DISCORD_API}${path}`, {
      headers: { Authorization: `Bot ${botToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const toMember = (user: DiscordUser, nick?: string | null): DiscordMember => ({
  id: String(user.id),
  username: String(user.username || ""),
  nick: nick ? String(nick) : undefined,
  globalName: user.global_name ? String(user.global_name) : undefined,
});

/**
 * Members of the bot's guild. The member list needs the Server Members Intent, so without it
 * the people who recently posted in the channel stand in.
 */
export async function fetchGuildMembers(
  botToken: string,
  defaultGuildId: string,
  channelId: string
): Promise<DiscordMember[]> {
  const guilds = await discordGet<Array<{ id?: string }>>("/users/@me/guilds", botToken, 5000);
  const guildId = (Array.isArray(guilds) && guilds[0]?.id) || defaultGuildId;

  const guildMembers = await discordGet<Array<{ user?: DiscordUser; nick?: string | null }>>(
    `/guilds/${guildId}/members?limit=1000`,
    botToken,
    8000
  );
  const members = Array.isArray(guildMembers)
    ? guildMembers.flatMap((m) => (m.user && !m.user.bot ? [toMember(m.user, m.nick)] : []))
    : [];
  if (members.length > 0) return members;

  const messages = await discordGet<Array<{ author?: DiscordUser }>>(
    `/channels/${channelId}/messages?limit=100`,
    botToken,
    8000
  );
  const seen = new Map<string, DiscordMember>();
  for (const { author } of Array.isArray(messages) ? messages : []) {
    if (author && !author.bot && !seen.has(String(author.id))) {
      seen.set(String(author.id), toMember(author));
    }
  }
  return [...seen.values()];
}

/** Why this Discord member looks like the owner of the nation, or null. */
function nationMatchReason(member: DiscordMember, countryName: string) {
  const nation = countryName.toLowerCase();
  const nick = (member.nick || "").toLowerCase();
  if (
    nick.includes(`[${nation}]`) ||
    nick.startsWith(`${nation} |`) ||
    nick.startsWith(`${nation} -`)
  ) {
    return `Server nickname "${member.nick}" contains nation bracket [${countryName}]`;
  }
  const names = [nick, (member.globalName || "").toLowerCase(), member.username.toLowerCase()];
  return names.includes(nation)
    ? `Discord identity directly matches nation "${countryName}"`
    : null;
}

/** Suggested identity links for guild members who are not yet linked to a user. */
export function suggestLinks(
  members: DiscordMember[],
  users: Array<{
    id: string;
    clerkUserId: string;
    discordUserId: string | null;
    country: { name: string } | null;
  }>
) {
  const suggestions: DiscordSuggestion[] = [];
  for (const member of members) {
    if (users.some((u) => u.discordUserId === member.id)) continue;
    for (const user of users) {
      const reason = user.country && nationMatchReason(member, user.country.name);
      if (!user.country || !reason) continue;
      suggestions.push({
        discordUserId: member.id,
        discordUsername: member.username,
        discordNick: member.nick,
        matchedUserId: user.id,
        matchedUserClerkId: user.clerkUserId,
        matchedCountryName: user.country.name,
        confidence: "HIGH",
        reason,
      });
      break;
    }
  }
  return suggestions;
}
