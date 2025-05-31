-- CreateTable
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Country" (
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
    "projected2040Population" REAL NOT NULL,
    "projected2040Gdp" REAL NOT NULL,
    "projected2040GdpPerCapita" REAL NOT NULL,
    "actualGdpGrowth" REAL NOT NULL,
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

-- CreateTable
CREATE TABLE "HistoricalDataPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "ixTimeTimestamp" DATETIME NOT NULL,
    "population" REAL NOT NULL,
    "gdpPerCapita" REAL NOT NULL,
    "totalGdp" REAL NOT NULL,
    "populationGrowthRate" REAL NOT NULL,
    "gdpGrowthRate" REAL NOT NULL,
    "landArea" REAL,
    "populationDensity" REAL,
    "gdpDensity" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricalDataPoint_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DmInputs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT,
    "ixTimeTimestamp" DATETIME NOT NULL,
    "inputType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "description" TEXT,
    "duration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DmInputs_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CalculationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ixTimeTimestamp" DATETIME NOT NULL,
    "countriesUpdated" INTEGER NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "globalGrowthFactor" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Post_name_idx" ON "Post"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE INDEX "Country_name_idx" ON "Country"("name");

-- CreateIndex
CREATE INDEX "Country_economicTier_idx" ON "Country"("economicTier");

-- CreateIndex
CREATE INDEX "Country_populationTier_idx" ON "Country"("populationTier");

-- CreateIndex
CREATE INDEX "Country_continent_idx" ON "Country"("continent");

-- CreateIndex
CREATE INDEX "Country_region_idx" ON "Country"("region");

-- CreateIndex
CREATE INDEX "HistoricalDataPoint_countryId_idx" ON "HistoricalDataPoint"("countryId");

-- CreateIndex
CREATE INDEX "HistoricalDataPoint_ixTimeTimestamp_idx" ON "HistoricalDataPoint"("ixTimeTimestamp");

-- CreateIndex
CREATE INDEX "DmInputs_countryId_idx" ON "DmInputs"("countryId");

-- CreateIndex
CREATE INDEX "DmInputs_ixTimeTimestamp_idx" ON "DmInputs"("ixTimeTimestamp");

-- CreateIndex
CREATE INDEX "DmInputs_isActive_idx" ON "DmInputs"("isActive");

-- CreateIndex
CREATE INDEX "DmInputs_inputType_idx" ON "DmInputs"("inputType");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "CalculationLog_timestamp_idx" ON "CalculationLog"("timestamp");

-- CreateIndex
CREATE INDEX "CalculationLog_ixTimeTimestamp_idx" ON "CalculationLog"("ixTimeTimestamp");
