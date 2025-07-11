/*
  Warnings:

  - You are about to drop the column `actualGdpGrowth` on the `Country` table. All the data in the column will be lost.
  - You are about to drop the column `projected2040Gdp` on the `Country` table. All the data in the column will be lost.
  - You are about to drop the column `projected2040GdpPerCapita` on the `Country` table. All the data in the column will be lost.
  - You are about to drop the column `projected2040Population` on the `Country` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "continent" TEXT,
    "region" TEXT,
    "governmentType" TEXT,
    "religion" TEXT,
    "leader" TEXT,
    "landArea" REAL,
    "areaSqMi" REAL,
    "baselinePopulation" REAL NOT NULL,
    "baselineGdpPerCapita" REAL NOT NULL,
    "maxGdpGrowthRate" REAL NOT NULL,
    "adjustedGdpGrowth" REAL NOT NULL,
    "populationGrowthRate" REAL NOT NULL,
    "currentPopulation" REAL NOT NULL,
    "currentGdpPerCapita" REAL NOT NULL,
    "currentTotalGdp" REAL NOT NULL,
    "populationDensity" REAL,
    "gdpDensity" REAL,
    "economicTier" TEXT NOT NULL,
    "populationTier" TEXT NOT NULL,
    "localGrowthFactor" REAL NOT NULL DEFAULT 1.0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baselineDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Country" ("adjustedGdpGrowth", "areaSqMi", "baselineDate", "baselineGdpPerCapita", "baselinePopulation", "continent", "createdAt", "currentGdpPerCapita", "currentPopulation", "currentTotalGdp", "economicTier", "gdpDensity", "governmentType", "id", "landArea", "lastCalculated", "leader", "localGrowthFactor", "maxGdpGrowthRate", "name", "populationDensity", "populationGrowthRate", "populationTier", "region", "religion", "updatedAt") SELECT "adjustedGdpGrowth", "areaSqMi", "baselineDate", "baselineGdpPerCapita", "baselinePopulation", "continent", "createdAt", "currentGdpPerCapita", "currentPopulation", "currentTotalGdp", "economicTier", "gdpDensity", "governmentType", "id", "landArea", "lastCalculated", "leader", "localGrowthFactor", "maxGdpGrowthRate", "name", "populationDensity", "populationGrowthRate", "populationTier", "region", "religion", "updatedAt" FROM "Country";
DROP TABLE "Country";
ALTER TABLE "new_Country" RENAME TO "Country";
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");
CREATE INDEX "Country_name_idx" ON "Country"("name");
CREATE INDEX "Country_economicTier_idx" ON "Country"("economicTier");
CREATE INDEX "Country_populationTier_idx" ON "Country"("populationTier");
CREATE INDEX "Country_continent_idx" ON "Country"("continent");
CREATE INDEX "Country_region_idx" ON "Country"("region");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
