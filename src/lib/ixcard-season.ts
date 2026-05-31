const SEASON_CONFIG_KEY = "currentIxCardSeason";

export async function getCurrentIxCardSeason(db: {
  systemConfig: {
    findUnique: (args: {
      where: { key: string };
    }) => Promise<{ value: string } | null>;
  };
}): Promise<number> {
  const config = await db.systemConfig.findUnique({
    where: { key: SEASON_CONFIG_KEY },
  });
  return config ? parseInt(config.value, 10) : 1;
}

export async function setCurrentIxCardSeason(
  db: {
    systemConfig: {
      upsert: (args: {
        where: { key: string };
        create: { key: string; value: string; description?: string };
        update: { value: string };
      }) => Promise<unknown>;
    };
  },
  season: number
): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: SEASON_CONFIG_KEY },
    create: {
      key: SEASON_CONFIG_KEY,
      value: String(season),
      description: "Current active IxCard season number",
    },
    update: { value: String(season) },
  });
}