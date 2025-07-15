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
    "currentPopulation" REAL NOT NULL,
    "currentGdpPerCapita" REAL NOT NULL,
    "currentTotalGdp" REAL NOT NULL,
    "populationDensity" REAL,
    "gdpDensity" REAL,
    "economicTier" TEXT NOT NULL,
    "populationTier" TEXT NOT NULL,
    "projected2040Population" REAL NOT NULL DEFAULT 0,
    "projected2040Gdp" REAL NOT NULL DEFAULT 0,
    "projected2040GdpPerCapita" REAL NOT NULL DEFAULT 0,
    "actualGdpGrowth" REAL NOT NULL DEFAULT 0,
    "nominalGDP" REAL,
    "realGDPGrowthRate" REAL,
    "inflationRate" REAL,
    "currencyExchangeRate" REAL,
    "laborForceParticipationRate" REAL,
    "employmentRate" REAL,
    "unemploymentRate" REAL,
    "totalWorkforce" REAL,
    "averageWorkweekHours" REAL,
    "minimumWage" REAL,
    "averageAnnualIncome" REAL,
    "taxRevenueGDPPercent" REAL,
    "governmentRevenueTotal" REAL,
    "taxRevenuePerCapita" REAL,
    "governmentBudgetGDPPercent" REAL,
    "budgetDeficitSurplus" REAL,
    "internalDebtGDPPercent" REAL,
    "externalDebtGDPPercent" REAL,
    "totalDebtGDPRatio" REAL,
    "debtPerCapita" REAL,
    "interestRates" REAL,
    "debtServiceCosts" REAL,
    "povertyRate" REAL,
    "incomeInequalityGini" REAL,
    "socialMobilityIndex" REAL,
    "totalGovernmentSpending" REAL,
    "spendingGDPPercent" REAL,
    "spendingPerCapita" REAL,
    "lifeExpectancy" REAL,
    "urbanPopulationPercent" REAL,
    "ruralPopulationPercent" REAL,
    "literacyRate" REAL,
    "localGrowthFactor" REAL NOT NULL DEFAULT 1.0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baselineDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EconomicProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "gdpGrowthVolatility" REAL,
    "economicComplexity" REAL,
    "innovationIndex" REAL,
    "competitivenessRank" INTEGER,
    "easeOfDoingBusiness" INTEGER,
    "corruptionIndex" REAL,
    "sectorBreakdown" TEXT,
    "exportsGDPPercent" REAL,
    "importsGDPPercent" REAL,
    "tradeBalance" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EconomicProfile_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaborMarket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "employmentBySector" TEXT,
    "youthUnemploymentRate" REAL,
    "femaleParticipationRate" REAL,
    "informalEmploymentRate" REAL,
    "medianWage" REAL,
    "wageGrowthRate" REAL,
    "wageBySector" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LaborMarket_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FiscalSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "personalIncomeTaxRates" TEXT,
    "corporateTaxRates" TEXT,
    "salesTaxRate" REAL,
    "propertyTaxRate" REAL,
    "payrollTaxRate" REAL,
    "exciseTaxRates" TEXT,
    "wealthTaxRate" REAL,
    "spendingByCategory" TEXT,
    "fiscalBalanceGDPPercent" REAL,
    "primaryBalanceGDPPercent" REAL,
    "taxEfficiency" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FiscalSystem_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeDistribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "economicClasses" TEXT,
    "top10PercentWealth" REAL,
    "bottom50PercentWealth" REAL,
    "middleClassPercent" REAL,
    "intergenerationalMobility" REAL,
    "educationMobility" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeDistribution_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernmentBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "spendingCategories" TEXT,
    "spendingEfficiency" REAL,
    "publicInvestmentRate" REAL,
    "socialSpendingPercent" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GovernmentBudget_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Demographics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "ageDistribution" TEXT,
    "regions" TEXT,
    "educationLevels" TEXT,
    "citizenshipStatuses" TEXT,
    "birthRate" REAL,
    "deathRate" REAL,
    "migrationRate" REAL,
    "dependencyRatio" REAL,
    "medianAge" REAL,
    "populationGrowthProjection" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Demographics_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "countryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "EconomicProfile_countryId_key" ON "EconomicProfile"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "LaborMarket_countryId_key" ON "LaborMarket"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalSystem_countryId_key" ON "FiscalSystem"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeDistribution_countryId_key" ON "IncomeDistribution"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentBudget_countryId_key" ON "GovernmentBudget"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Demographics_countryId_key" ON "Demographics"("countryId");

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

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_countryId_key" ON "User"("countryId");

-- CreateIndex
CREATE INDEX "User_clerkUserId_idx" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_countryId_idx" ON "User"("countryId");
