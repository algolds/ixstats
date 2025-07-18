-- CreateTable
CREATE TABLE "EconomicModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "baseYear" INTEGER NOT NULL,
    "projectionYears" INTEGER NOT NULL,
    "gdpGrowthRate" REAL NOT NULL,
    "inflationRate" REAL NOT NULL,
    "unemploymentRate" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL,
    "populationGrowthRate" REAL NOT NULL,
    "investmentRate" REAL NOT NULL,
    "fiscalBalance" REAL NOT NULL,
    "tradeBalance" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EconomicModel_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectoralOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "economicModelId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "agriculture" REAL NOT NULL,
    "industry" REAL NOT NULL,
    "services" REAL NOT NULL,
    "government" REAL NOT NULL,
    "totalGDP" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectoralOutput_economicModelId_fkey" FOREIGN KEY ("economicModelId") REFERENCES "EconomicModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyEffect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "economicModelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gdpEffectPercentage" REAL NOT NULL,
    "inflationEffectPercentage" REAL NOT NULL,
    "employmentEffectPercentage" REAL NOT NULL,
    "yearImplemented" INTEGER NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicyEffect_economicModelId_fkey" FOREIGN KEY ("economicModelId") REFERENCES "EconomicModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "region" TEXT,
    "affectedCountries" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CrisisEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedCountries" TEXT,
    "casualties" INTEGER,
    "economicImpact" REAL,
    "responseStatus" TEXT,
    "timestamp" DATETIME NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiplomaticRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country1" TEXT NOT NULL,
    "country2" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "strength" INTEGER NOT NULL,
    "treaties" TEXT,
    "lastContact" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "diplomaticChannels" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Treaty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parties" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signedDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "description" TEXT,
    "complianceRate" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EconomicIndicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "globalGDP" REAL NOT NULL,
    "globalGrowth" REAL NOT NULL,
    "inflationRate" REAL NOT NULL,
    "unemploymentRate" REAL NOT NULL,
    "tradeVolume" REAL NOT NULL,
    "currencyVolatility" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EconomicModel_countryId_key" ON "EconomicModel"("countryId");
