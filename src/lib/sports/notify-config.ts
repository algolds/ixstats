/**
 * Global on/off switches for the sports auto-notifications (feed bulletins, LLM
 * narration, season/playoff/promo posts, club DMs, Discord mirror). Stored as
 * `sports:notify:*` rows in SystemConfig and edited from the MyLeague admin
 * dashboard. Every flag defaults ON — a missing or blank row means enabled, so
 * existing installs keep their current behaviour until an admin turns something off.
 */

export interface SportsNotifyConfig {
  matchdayBulletins: boolean;
  llmNarration: boolean;
  seasonBulletins: boolean;
  clubDms: boolean;
  discordMirror: boolean;
}

export const SPORTS_NOTIFY_KEYS: Record<keyof SportsNotifyConfig, string> = {
  matchdayBulletins: "sports:notify:matchdayBulletins",
  llmNarration: "sports:notify:llmNarration",
  seasonBulletins: "sports:notify:seasonBulletins",
  clubDms: "sports:notify:clubDms",
  discordMirror: "sports:notify:discordMirror",
};

const ALL_ON: SportsNotifyConfig = {
  matchdayBulletins: true,
  llmNarration: true,
  seasonBulletins: true,
  clubDms: true,
  discordMirror: true,
};

// ponytail: prisma typed `any` so both the real client and tx clients can pass.
export async function getSportsNotifyConfig(prisma: any): Promise<SportsNotifyConfig> {
  try {
    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: Object.values(SPORTS_NOTIFY_KEYS) } },
    });
    const on = (k: string) => rows.find((r: any) => r.key === k)?.value !== "false"; // default true
    return {
      matchdayBulletins: on(SPORTS_NOTIFY_KEYS.matchdayBulletins),
      llmNarration: on(SPORTS_NOTIFY_KEYS.llmNarration),
      seasonBulletins: on(SPORTS_NOTIFY_KEYS.seasonBulletins),
      clubDms: on(SPORTS_NOTIFY_KEYS.clubDms),
      discordMirror: on(SPORTS_NOTIFY_KEYS.discordMirror),
    };
  } catch {
    return ALL_ON; // never block the sim on a config read — fail open
  }
}
