/**
 * Master coordinator for sports league demo seeding.
 *
 * Dispatches to individual domain seeders in ./sports/ and exports
 * the canonical seedSportsLeagues function.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";
import { seedCaphirianSoccerLeague, seedYonderreSoccerLeague } from "./sports/seed-soccer";
import { seedOHLHockeyLeague } from "./sports/seed-hockey";
import { seedF1League } from "./sports/seed-f1";
import { seedBoxingLeague } from "./sports/seed-boxing";

type Prisma = PrismaClient;

export {
  seedCaphirianSoccerLeague,
  seedYonderreSoccerLeague,
  seedOHLHockeyLeague,
  seedF1League,
  seedBoxingLeague,
};

export interface SeedingOptions {
  seedCaphirianSoccer?: boolean;
  seedYonderreSoccer?: boolean;
  seedOHLHockey?: boolean;
  seedF1?: boolean;
  seedBoxing?: boolean;
}

export async function seedSportsLeagues(
  prisma: Prisma,
  countryId: string,
  userId: string,
  options?: SeedingOptions
): Promise<number> {
  let count = 0;
  const ixNow = IxTime.getCurrentIxTime();

  if (!options) {
    const existing = await prisma.sportLeague.count({ where: { isCanonical: true } });
    if (existing > 0) {
      return 0;
    }
  }

  const seedCaphirian = options ? !!options.seedCaphirianSoccer : true;
  const seedYonderre = options ? !!options.seedYonderreSoccer : true;
  const seedOHL = options ? !!options.seedOHLHockey : true;
  const seedF1 = options ? !!options.seedF1 : true;
  const seedBoxing = options ? !!options.seedBoxing : true;

  if (seedCaphirian) {
    count += await seedCaphirianSoccerLeague(prisma, userId, ixNow);
  }
  if (seedYonderre) {
    count += await seedYonderreSoccerLeague(prisma, userId, ixNow);
  }
  if (seedOHL) {
    count += await seedOHLHockeyLeague(prisma, userId, ixNow);
  }
  if (seedF1) {
    count += await seedF1League(prisma, userId, ixNow);
  }
  if (seedBoxing) {
    count += await seedBoxingLeague(prisma, userId, ixNow);
  }

  return count;
}
