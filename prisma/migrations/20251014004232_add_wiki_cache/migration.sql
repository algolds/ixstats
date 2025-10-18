/*
  Warnings:

  - You are about to drop the column `mentionedUserId` on the `PostMention` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `PostReaction` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ThinkpagesPost` table. All the data in the column will be lost.
  - Added the required column `mentionedAccountId` to the `PostMention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountId` to the `PostReaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountId` to the `ThinkpagesPost` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT
);

-- CreateTable
CREATE TABLE "ScheduledChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "impactLevel" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "appliedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "warnings" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinkpagesAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "postingFrequency" TEXT NOT NULL DEFAULT 'moderate',
    "politicalLean" TEXT NOT NULL DEFAULT 'center',
    "personality" TEXT NOT NULL DEFAULT 'casual',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThinkpagesAccount_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceBriefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "urgency" TEXT NOT NULL,
    "impactMagnitude" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntelligenceRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "briefingId" TEXT,
    "countryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedDuration" TEXT NOT NULL,
    "estimatedCost" TEXT NOT NULL,
    "estimatedBenefit" TEXT NOT NULL,
    "prerequisites" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "successProbability" REAL NOT NULL,
    "economicImpact" REAL NOT NULL DEFAULT 0,
    "socialImpact" REAL NOT NULL DEFAULT 0,
    "diplomaticImpact" REAL NOT NULL DEFAULT 0,
    "isImplemented" BOOLEAN NOT NULL DEFAULT false,
    "implementedAt" DATETIME,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntelligenceRecommendation_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "IntelligenceBriefing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "briefingId" TEXT,
    "countryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "currentValue" REAL NOT NULL,
    "expectedValue" REAL NOT NULL,
    "deviation" REAL NOT NULL,
    "zScore" REAL NOT NULL,
    "factors" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntelligenceAlert_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "IntelligenceBriefing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VitalitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "trend" TEXT NOT NULL,
    "changeValue" REAL NOT NULL,
    "changePeriod" TEXT NOT NULL,
    "keyMetrics" TEXT NOT NULL,
    "peerAverage" REAL NOT NULL,
    "regionalAverage" REAL NOT NULL,
    "historicalBest" REAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalCountries" INTEGER NOT NULL,
    "criticalAlertsCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ixTime" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MilitaryBranch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "branchType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "motto" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "established" TEXT,
    "activeDuty" INTEGER NOT NULL DEFAULT 0,
    "reserves" INTEGER NOT NULL DEFAULT 0,
    "civilianStaff" INTEGER NOT NULL DEFAULT 0,
    "annualBudget" REAL NOT NULL DEFAULT 0,
    "budgetPercent" REAL NOT NULL DEFAULT 0,
    "readinessLevel" REAL NOT NULL DEFAULT 50,
    "technologyLevel" REAL NOT NULL DEFAULT 50,
    "trainingLevel" REAL NOT NULL DEFAULT 50,
    "morale" REAL NOT NULL DEFAULT 50,
    "deploymentCapacity" REAL NOT NULL DEFAULT 50,
    "sustainmentCapacity" REAL NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MilitaryBranch_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MilitaryUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "designation" TEXT,
    "description" TEXT,
    "personnel" INTEGER NOT NULL DEFAULT 0,
    "commanderName" TEXT,
    "commanderRank" TEXT,
    "headquarters" TEXT,
    "readiness" REAL NOT NULL DEFAULT 50,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MilitaryUnit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "MilitaryBranch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MilitaryAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "unitId" TEXT,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "operational" INTEGER NOT NULL DEFAULT 1,
    "acquisitionCost" REAL NOT NULL DEFAULT 0,
    "maintenanceCost" REAL NOT NULL DEFAULT 0,
    "modernizationLevel" REAL NOT NULL DEFAULT 50,
    "capability" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MilitaryAsset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "MilitaryBranch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MilitaryAsset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "MilitaryUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityThreat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "userId" TEXT,
    "threatName" TEXT NOT NULL,
    "threatType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'monitoring',
    "description" TEXT,
    "likelihood" REAL NOT NULL DEFAULT 50,
    "impact" REAL NOT NULL DEFAULT 50,
    "urgency" TEXT,
    "actorType" TEXT,
    "actorName" TEXT,
    "actorLocation" TEXT,
    "actorCapability" REAL NOT NULL DEFAULT 50,
    "potentialCasualties" INTEGER NOT NULL DEFAULT 0,
    "economicImpact" REAL NOT NULL DEFAULT 0,
    "politicalImpact" TEXT,
    "infrastructureRisk" REAL NOT NULL DEFAULT 0,
    "responseLevel" TEXT,
    "mitigationActions" TEXT,
    "resourcesAllocated" REAL NOT NULL DEFAULT 0,
    "intelligenceSource" TEXT,
    "confidenceLevel" REAL NOT NULL DEFAULT 50,
    "estimatedTimeline" TEXT,
    "tags" TEXT,
    "lastUpdated" DATETIME NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityThreat_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThreatIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "damage" REAL NOT NULL DEFAULT 0,
    "location" TEXT,
    "responseActions" TEXT,
    "effectiveness" REAL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThreatIncident_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "SecurityThreat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefenseBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "totalBudget" REAL NOT NULL DEFAULT 0,
    "gdpPercent" REAL NOT NULL DEFAULT 0,
    "perCapita" REAL NOT NULL DEFAULT 0,
    "personnelCosts" REAL NOT NULL DEFAULT 0,
    "operationsMaintenance" REAL NOT NULL DEFAULT 0,
    "procurement" REAL NOT NULL DEFAULT 0,
    "rdteCosts" REAL NOT NULL DEFAULT 0,
    "militaryConstruction" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DefenseBudget_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "overallSecurityScore" REAL NOT NULL DEFAULT 60,
    "securityLevel" TEXT NOT NULL DEFAULT 'moderate',
    "securityTrend" TEXT NOT NULL DEFAULT 'stable',
    "militaryStrength" REAL NOT NULL DEFAULT 60,
    "internalStability" REAL NOT NULL DEFAULT 60,
    "borderSecurity" REAL NOT NULL DEFAULT 60,
    "cybersecurity" REAL NOT NULL DEFAULT 50,
    "counterTerrorism" REAL NOT NULL DEFAULT 55,
    "militaryReadiness" REAL NOT NULL DEFAULT 65,
    "emergencyResponse" REAL NOT NULL DEFAULT 60,
    "disasterPreparedness" REAL NOT NULL DEFAULT 55,
    "activeThreatCount" INTEGER NOT NULL DEFAULT 0,
    "highSeverityThreats" INTEGER NOT NULL DEFAULT 0,
    "lastAssessed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityAssessment_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalStabilityMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "stabilityScore" REAL NOT NULL DEFAULT 75,
    "stabilityTrend" TEXT NOT NULL DEFAULT 'stable',
    "crimeRate" REAL NOT NULL DEFAULT 5,
    "violentCrimeRate" REAL NOT NULL DEFAULT 2,
    "propertyCrimeRate" REAL NOT NULL DEFAULT 10,
    "organizedCrimeLevel" REAL NOT NULL DEFAULT 3,
    "policingEffectiveness" REAL NOT NULL DEFAULT 60,
    "justiceSystemEfficiency" REAL NOT NULL DEFAULT 50,
    "protestFrequency" REAL NOT NULL DEFAULT 5,
    "riotRisk" REAL NOT NULL DEFAULT 10,
    "civilDisobedience" REAL NOT NULL DEFAULT 5,
    "socialCohesion" REAL NOT NULL DEFAULT 70,
    "ethnicTension" REAL NOT NULL DEFAULT 20,
    "politicalPolarization" REAL NOT NULL DEFAULT 40,
    "trustInGovernment" REAL NOT NULL DEFAULT 50,
    "trustInPolice" REAL NOT NULL DEFAULT 55,
    "fearOfCrime" REAL NOT NULL DEFAULT 35,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalStabilityMetrics_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "arrested" INTEGER NOT NULL DEFAULT 0,
    "economicImpact" REAL NOT NULL DEFAULT 0,
    "stabilityImpact" REAL NOT NULL DEFAULT 0,
    "region" TEXT,
    "city" TEXT,
    "triggerFactors" TEXT,
    "rngSeed" TEXT,
    "resolutionNotes" TEXT,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityEvent_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BorderSecurity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "overallSecurityLevel" REAL NOT NULL DEFAULT 70,
    "securityStatus" TEXT NOT NULL DEFAULT 'moderate',
    "borderIntegrity" REAL NOT NULL DEFAULT 85,
    "borderLength" REAL,
    "landBorders" INTEGER NOT NULL DEFAULT 0,
    "maritimeBorders" INTEGER NOT NULL DEFAULT 0,
    "borderAgents" INTEGER NOT NULL DEFAULT 0,
    "checkpoints" INTEGER NOT NULL DEFAULT 0,
    "surveillanceSystems" INTEGER NOT NULL DEFAULT 0,
    "interceptionRate" REAL NOT NULL DEFAULT 60,
    "processingEfficiency" REAL NOT NULL DEFAULT 70,
    "illegalCrossings" INTEGER NOT NULL DEFAULT 0,
    "smugglingActivity" REAL NOT NULL DEFAULT 20,
    "traffickingRisk" REAL NOT NULL DEFAULT 15,
    "refugeePresure" REAL NOT NULL DEFAULT 10,
    "technologyLevel" REAL NOT NULL DEFAULT 50,
    "infrastructureQuality" REAL NOT NULL DEFAULT 60,
    "lastAssessed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BorderSecurity_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NeighborThreatAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borderSecurityId" TEXT NOT NULL,
    "neighborName" TEXT NOT NULL,
    "neighborCountryId" TEXT,
    "borderType" TEXT NOT NULL,
    "borderLength" REAL,
    "threatLevel" TEXT NOT NULL DEFAULT 'low',
    "threatScore" REAL NOT NULL DEFAULT 20,
    "militaryThreat" REAL NOT NULL DEFAULT 10,
    "terrorismRisk" REAL NOT NULL DEFAULT 15,
    "smugglingRisk" REAL NOT NULL DEFAULT 25,
    "refugeeFlow" REAL NOT NULL DEFAULT 20,
    "politicalStability" REAL NOT NULL DEFAULT 60,
    "diplomaticRelations" TEXT NOT NULL DEFAULT 'neutral',
    "tradeVolume" REAL NOT NULL DEFAULT 0,
    "treatyStatus" TEXT,
    "notes" TEXT,
    "lastAssessed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NeighborThreatAssessment_borderSecurityId_fkey" FOREIGN KEY ("borderSecurityId") REFERENCES "BorderSecurity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CountryFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerCountryId" TEXT NOT NULL,
    "followedCountryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CountryFollow_followerCountryId_fkey" FOREIGN KEY ("followerCountryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CountryFollow_followedCountryId_fkey" FOREIGN KEY ("followedCountryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "countryId" TEXT,
    "requestId" TEXT,
    "traceId" TEXT,
    "duration" INTEGER,
    "errorName" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "metadata" TEXT,
    "component" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LogRetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logLevel" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "archiveAfterDays" INTEGER,
    "deleteAfterDays" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WikiCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "countryName" TEXT,
    "metadata" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'game',
    "userId" TEXT,
    "countryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "relatedCountries" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ActivityFeed" ("category", "comments", "countryId", "createdAt", "description", "id", "likes", "metadata", "priority", "relatedCountries", "shares", "title", "type", "updatedAt", "userId", "views", "visibility") SELECT "category", "comments", "countryId", "createdAt", "description", "id", "likes", "metadata", "priority", "relatedCountries", "shares", "title", "type", "updatedAt", "userId", "views", "visibility" FROM "ActivityFeed";
DROP TABLE "ActivityFeed";
ALTER TABLE "new_ActivityFeed" RENAME TO "ActivityFeed";
CREATE INDEX "ActivityFeed_type_idx" ON "ActivityFeed"("type");
CREATE INDEX "ActivityFeed_category_idx" ON "ActivityFeed"("category");
CREATE INDEX "ActivityFeed_userId_idx" ON "ActivityFeed"("userId");
CREATE INDEX "ActivityFeed_countryId_idx" ON "ActivityFeed"("countryId");
CREATE INDEX "ActivityFeed_priority_idx" ON "ActivityFeed"("priority");
CREATE INDEX "ActivityFeed_createdAt_idx" ON "ActivityFeed"("createdAt");
CREATE INDEX "ActivityFeed_visibility_idx" ON "ActivityFeed"("visibility");
CREATE TABLE "new_BudgetScenarioCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "allocatedAmount" REAL NOT NULL,
    "allocatedPercent" REAL NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "efficiency" REAL NOT NULL DEFAULT 50,
    "performance" REAL NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetScenarioCategory_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "BudgetScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetScenarioCategory" ("allocatedAmount", "allocatedPercent", "categoryName", "createdAt", "efficiency", "id", "performance", "priority", "scenarioId") SELECT "allocatedAmount", "allocatedPercent", "categoryName", "createdAt", "efficiency", "id", "performance", "priority", "scenarioId" FROM "BudgetScenarioCategory";
DROP TABLE "BudgetScenarioCategory";
ALTER TABLE "new_BudgetScenarioCategory" RENAME TO "BudgetScenarioCategory";
CREATE INDEX "BudgetScenarioCategory_scenarioId_idx" ON "BudgetScenarioCategory"("scenarioId");
CREATE TABLE "new_Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "continent" TEXT,
    "region" TEXT,
    "governmentType" TEXT,
    "religion" TEXT,
    "leader" TEXT,
    "flag" TEXT,
    "coatOfArms" TEXT,
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
    "economicVitality" REAL NOT NULL DEFAULT 0,
    "populationWellbeing" REAL NOT NULL DEFAULT 0,
    "diplomaticStanding" REAL NOT NULL DEFAULT 0,
    "governmentalEfficiency" REAL NOT NULL DEFAULT 0,
    "overallNationalHealth" REAL NOT NULL DEFAULT 0,
    "activeAlliances" INTEGER NOT NULL DEFAULT 0,
    "activeTreaties" INTEGER NOT NULL DEFAULT 0,
    "diplomaticReputation" TEXT NOT NULL DEFAULT 'Neutral',
    "publicApproval" REAL NOT NULL DEFAULT 50,
    "governmentEfficiency" TEXT NOT NULL DEFAULT 'Moderate',
    "politicalStability" TEXT NOT NULL DEFAULT 'Stable',
    "tradeBalance" REAL NOT NULL DEFAULT 0,
    "infrastructureRating" REAL NOT NULL DEFAULT 50,
    "usesAtomicGovernment" BOOLEAN NOT NULL DEFAULT true,
    "hideDiplomaticOps" BOOLEAN NOT NULL DEFAULT false,
    "hideStratcommIntel" BOOLEAN NOT NULL DEFAULT false,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baselineDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Country" ("actualGdpGrowth", "adjustedGdpGrowth", "areaSqMi", "averageAnnualIncome", "averageWorkweekHours", "baselineDate", "baselineGdpPerCapita", "baselinePopulation", "budgetDeficitSurplus", "coatOfArms", "continent", "createdAt", "currencyExchangeRate", "currentGdpPerCapita", "currentPopulation", "currentTotalGdp", "debtPerCapita", "debtServiceCosts", "economicTier", "employmentRate", "externalDebtGDPPercent", "flag", "gdpDensity", "governmentBudgetGDPPercent", "governmentRevenueTotal", "governmentType", "hideDiplomaticOps", "hideStratcommIntel", "id", "incomeInequalityGini", "inflationRate", "interestRates", "internalDebtGDPPercent", "laborForceParticipationRate", "landArea", "lastCalculated", "leader", "lifeExpectancy", "literacyRate", "localGrowthFactor", "maxGdpGrowthRate", "minimumWage", "name", "nominalGDP", "populationDensity", "populationGrowthRate", "populationTier", "povertyRate", "projected2040Gdp", "projected2040GdpPerCapita", "projected2040Population", "realGDPGrowthRate", "region", "religion", "ruralPopulationPercent", "socialMobilityIndex", "spendingGDPPercent", "spendingPerCapita", "taxRevenueGDPPercent", "taxRevenuePerCapita", "totalDebtGDPRatio", "totalGovernmentSpending", "totalWorkforce", "unemploymentRate", "updatedAt", "urbanPopulationPercent", "usesAtomicGovernment") SELECT "actualGdpGrowth", "adjustedGdpGrowth", "areaSqMi", "averageAnnualIncome", "averageWorkweekHours", "baselineDate", "baselineGdpPerCapita", "baselinePopulation", "budgetDeficitSurplus", "coatOfArms", "continent", "createdAt", "currencyExchangeRate", "currentGdpPerCapita", "currentPopulation", "currentTotalGdp", "debtPerCapita", "debtServiceCosts", "economicTier", "employmentRate", "externalDebtGDPPercent", "flag", "gdpDensity", "governmentBudgetGDPPercent", "governmentRevenueTotal", "governmentType", "hideDiplomaticOps", "hideStratcommIntel", "id", "incomeInequalityGini", "inflationRate", "interestRates", "internalDebtGDPPercent", "laborForceParticipationRate", "landArea", "lastCalculated", "leader", "lifeExpectancy", "literacyRate", "localGrowthFactor", "maxGdpGrowthRate", "minimumWage", "name", "nominalGDP", "populationDensity", "populationGrowthRate", "populationTier", "povertyRate", "projected2040Gdp", "projected2040GdpPerCapita", "projected2040Population", "realGDPGrowthRate", "region", "religion", "ruralPopulationPercent", "socialMobilityIndex", "spendingGDPPercent", "spendingPerCapita", "taxRevenueGDPPercent", "taxRevenuePerCapita", "totalDebtGDPRatio", "totalGovernmentSpending", "totalWorkforce", "unemploymentRate", "updatedAt", "urbanPopulationPercent", "usesAtomicGovernment" FROM "Country";
DROP TABLE "Country";
ALTER TABLE "new_Country" RENAME TO "Country";
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");
CREATE UNIQUE INDEX "Country_slug_key" ON "Country"("slug");
CREATE INDEX "Country_name_idx" ON "Country"("name");
CREATE INDEX "Country_economicTier_idx" ON "Country"("economicTier");
CREATE INDEX "Country_populationTier_idx" ON "Country"("populationTier");
CREATE INDEX "Country_continent_idx" ON "Country"("continent");
CREATE INDEX "Country_region_idx" ON "Country"("region");
CREATE TABLE "new_CrisisEvent" (
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
    "category" TEXT NOT NULL DEFAULT 'governance',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CrisisEvent" ("affectedCountries", "casualties", "category", "createdAt", "description", "economicImpact", "id", "location", "responseStatus", "severity", "timestamp", "title", "type", "updatedAt") SELECT "affectedCountries", "casualties", "category", "createdAt", "description", "economicImpact", "id", "location", "responseStatus", "severity", "timestamp", "title", "type", "updatedAt" FROM "CrisisEvent";
DROP TABLE "CrisisEvent";
ALTER TABLE "new_CrisisEvent" RENAME TO "CrisisEvent";
CREATE TABLE "new_Embassy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostCountryId" TEXT NOT NULL,
    "guestCountryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "ambassadorName" TEXT,
    "staffCount" INTEGER NOT NULL DEFAULT 1,
    "establishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "services" TEXT,
    "securityLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "establishmentCost" REAL NOT NULL DEFAULT 0,
    "maintenanceCost" REAL NOT NULL DEFAULT 1000,
    "lastMaintenancePaid" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "budget" REAL NOT NULL DEFAULT 50000,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "upgradeProgress" REAL NOT NULL DEFAULT 0,
    "influence" REAL NOT NULL DEFAULT 10,
    "effectiveness" REAL NOT NULL DEFAULT 50,
    "reputation" REAL NOT NULL DEFAULT 50,
    "maxStaff" INTEGER NOT NULL DEFAULT 5,
    "currentMissions" INTEGER NOT NULL DEFAULT 0,
    "maxMissions" INTEGER NOT NULL DEFAULT 2,
    "specialization" TEXT,
    "specializationLevel" INTEGER NOT NULL DEFAULT 0,
    "buffs" TEXT,
    "debuffs" TEXT,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Embassy_hostCountryId_fkey" FOREIGN KEY ("hostCountryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Embassy_guestCountryId_fkey" FOREIGN KEY ("guestCountryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Embassy" ("ambassadorName", "budget", "buffs", "createdAt", "currentMissions", "debuffs", "effectiveness", "establishedAt", "establishmentCost", "experience", "guestCountryId", "hostCountryId", "id", "influence", "lastActivity", "lastMaintenancePaid", "level", "location", "maintenanceCost", "maxMissions", "maxStaff", "name", "reputation", "securityLevel", "services", "specialization", "specializationLevel", "staffCount", "status", "updatedAt", "upgradeProgress") SELECT "ambassadorName", "budget", "buffs", "createdAt", "currentMissions", "debuffs", "effectiveness", "establishedAt", "establishmentCost", "experience", "guestCountryId", "hostCountryId", "id", "influence", "lastActivity", "lastMaintenancePaid", "level", "location", "maintenanceCost", "maxMissions", "maxStaff", "name", "reputation", "securityLevel", "services", "specialization", "specializationLevel", "staffCount", "status", "updatedAt", "upgradeProgress" FROM "Embassy";
DROP TABLE "Embassy";
ALTER TABLE "new_Embassy" RENAME TO "Embassy";
CREATE INDEX "Embassy_hostCountryId_idx" ON "Embassy"("hostCountryId");
CREATE INDEX "Embassy_guestCountryId_idx" ON "Embassy"("guestCountryId");
CREATE INDEX "Embassy_status_idx" ON "Embassy"("status");
CREATE INDEX "Embassy_level_idx" ON "Embassy"("level");
CREATE INDEX "Embassy_specialization_idx" ON "Embassy"("specialization");
CREATE UNIQUE INDEX "Embassy_hostCountryId_guestCountryId_key" ON "Embassy"("hostCountryId", "guestCountryId");
CREATE TABLE "new_IntelligenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "source" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "region" TEXT,
    "affectedCountries" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER,
    "itemType" TEXT NOT NULL DEFAULT 'update',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_IntelligenceItem" ("actionable", "affectedCountries", "category", "confidence", "content", "createdAt", "id", "isActive", "itemType", "priority", "region", "severity", "source", "timestamp", "title", "updatedAt") SELECT "actionable", "affectedCountries", "category", "confidence", "content", "createdAt", "id", "isActive", "itemType", "priority", "region", "severity", "source", "timestamp", "title", "updatedAt" FROM "IntelligenceItem";
DROP TABLE "IntelligenceItem";
ALTER TABLE "new_IntelligenceItem" RENAME TO "IntelligenceItem";
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "countryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "href" TEXT,
    "type" TEXT,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "severity" TEXT NOT NULL DEFAULT 'informational',
    "source" TEXT,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "relevanceScore" REAL,
    "deliveryMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Notification" ("countryId", "createdAt", "description", "href", "id", "read", "title", "type", "updatedAt", "userId") SELECT "countryId", "createdAt", "description", "href", "id", "read", "title", "type", "updatedAt", "userId" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_userId_read_dismissed_idx" ON "Notification"("userId", "read", "dismissed");
CREATE INDEX "Notification_countryId_read_dismissed_idx" ON "Notification"("countryId", "read", "dismissed");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Notification_priority_read_idx" ON "Notification"("priority", "read");
CREATE TABLE "new_PostMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "mentionedAccountId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PostMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostMention_mentionedAccountId_fkey" FOREIGN KEY ("mentionedAccountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostMention" ("id", "position", "postId") SELECT "id", "position", "postId" FROM "PostMention";
DROP TABLE "PostMention";
ALTER TABLE "new_PostMention" RENAME TO "PostMention";
CREATE INDEX "PostMention_postId_idx" ON "PostMention"("postId");
CREATE INDEX "PostMention_mentionedAccountId_idx" ON "PostMention"("mentionedAccountId");
CREATE TABLE "new_PostReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostReaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostReaction" ("id", "postId", "reactionType", "timestamp") SELECT "id", "postId", "reactionType", "timestamp" FROM "PostReaction";
DROP TABLE "PostReaction";
ALTER TABLE "new_PostReaction" RENAME TO "PostReaction";
CREATE INDEX "PostReaction_postId_idx" ON "PostReaction"("postId");
CREATE INDEX "PostReaction_accountId_idx" ON "PostReaction"("accountId");
CREATE INDEX "PostReaction_reactionType_idx" ON "PostReaction"("reactionType");
CREATE UNIQUE INDEX "PostReaction_postId_accountId_key" ON "PostReaction"("postId", "accountId");
CREATE TABLE "new_ThinkpagesPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hashtags" TEXT,
    "visualizations" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'original',
    "parentPostId" TEXT,
    "repostOfId" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reactionCounts" TEXT,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "ixTimeTimestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThinkpagesPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinkpagesPost_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "ThinkpagesPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ThinkpagesPost_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "ThinkpagesPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThinkpagesPost" ("content", "createdAt", "hashtags", "id", "impressions", "ixTimeTimestamp", "likeCount", "parentPostId", "pinned", "postType", "reactionCounts", "replyCount", "repostCount", "repostOfId", "trending", "updatedAt", "visibility") SELECT "content", "createdAt", "hashtags", "id", "impressions", "ixTimeTimestamp", "likeCount", "parentPostId", "pinned", "postType", "reactionCounts", "replyCount", "repostCount", "repostOfId", "trending", "updatedAt", "visibility" FROM "ThinkpagesPost";
DROP TABLE "ThinkpagesPost";
ALTER TABLE "new_ThinkpagesPost" RENAME TO "ThinkpagesPost";
CREATE INDEX "ThinkpagesPost_accountId_idx" ON "ThinkpagesPost"("accountId");
CREATE INDEX "ThinkpagesPost_ixTimeTimestamp_idx" ON "ThinkpagesPost"("ixTimeTimestamp");
CREATE INDEX "ThinkpagesPost_trending_idx" ON "ThinkpagesPost"("trending");
CREATE INDEX "ThinkpagesPost_visibility_idx" ON "ThinkpagesPost"("visibility");
CREATE INDEX "ThinkpagesPost_postType_idx" ON "ThinkpagesPost"("postType");
CREATE INDEX "ThinkpagesPost_parentPostId_idx" ON "ThinkpagesPost"("parentPostId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetId_idx" ON "AdminAuditLog"("targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_timestamp_idx" ON "AdminAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "ScheduledChange_userId_idx" ON "ScheduledChange"("userId");

-- CreateIndex
CREATE INDEX "ScheduledChange_countryId_idx" ON "ScheduledChange"("countryId");

-- CreateIndex
CREATE INDEX "ScheduledChange_status_idx" ON "ScheduledChange"("status");

-- CreateIndex
CREATE INDEX "ScheduledChange_scheduledFor_idx" ON "ScheduledChange"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ThinkpagesAccount_username_key" ON "ThinkpagesAccount"("username");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_clerkUserId_idx" ON "ThinkpagesAccount"("clerkUserId");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_countryId_idx" ON "ThinkpagesAccount"("countryId");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_accountType_idx" ON "ThinkpagesAccount"("accountType");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_username_idx" ON "ThinkpagesAccount"("username");

-- CreateIndex
CREATE INDEX "IntelligenceBriefing_countryId_idx" ON "IntelligenceBriefing"("countryId");

-- CreateIndex
CREATE INDEX "IntelligenceBriefing_type_idx" ON "IntelligenceBriefing"("type");

-- CreateIndex
CREATE INDEX "IntelligenceBriefing_priority_idx" ON "IntelligenceBriefing"("priority");

-- CreateIndex
CREATE INDEX "IntelligenceBriefing_isActive_idx" ON "IntelligenceBriefing"("isActive");

-- CreateIndex
CREATE INDEX "IntelligenceBriefing_generatedAt_idx" ON "IntelligenceBriefing"("generatedAt");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_countryId_idx" ON "IntelligenceRecommendation"("countryId");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_category_idx" ON "IntelligenceRecommendation"("category");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_urgency_idx" ON "IntelligenceRecommendation"("urgency");

-- CreateIndex
CREATE INDEX "IntelligenceRecommendation_isActive_idx" ON "IntelligenceRecommendation"("isActive");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_countryId_idx" ON "IntelligenceAlert"("countryId");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_severity_idx" ON "IntelligenceAlert"("severity");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_category_idx" ON "IntelligenceAlert"("category");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_isActive_idx" ON "IntelligenceAlert"("isActive");

-- CreateIndex
CREATE INDEX "IntelligenceAlert_detectedAt_idx" ON "IntelligenceAlert"("detectedAt");

-- CreateIndex
CREATE INDEX "VitalitySnapshot_countryId_idx" ON "VitalitySnapshot"("countryId");

-- CreateIndex
CREATE INDEX "VitalitySnapshot_area_idx" ON "VitalitySnapshot"("area");

-- CreateIndex
CREATE INDEX "VitalitySnapshot_calculatedAt_idx" ON "VitalitySnapshot"("calculatedAt");

-- CreateIndex
CREATE INDEX "VitalitySnapshot_ixTime_idx" ON "VitalitySnapshot"("ixTime");

-- CreateIndex
CREATE INDEX "MilitaryBranch_countryId_idx" ON "MilitaryBranch"("countryId");

-- CreateIndex
CREATE INDEX "MilitaryBranch_branchType_idx" ON "MilitaryBranch"("branchType");

-- CreateIndex
CREATE INDEX "MilitaryBranch_isActive_idx" ON "MilitaryBranch"("isActive");

-- CreateIndex
CREATE INDEX "MilitaryUnit_branchId_idx" ON "MilitaryUnit"("branchId");

-- CreateIndex
CREATE INDEX "MilitaryAsset_branchId_idx" ON "MilitaryAsset"("branchId");

-- CreateIndex
CREATE INDEX "MilitaryAsset_unitId_idx" ON "MilitaryAsset"("unitId");

-- CreateIndex
CREATE INDEX "MilitaryAsset_assetType_idx" ON "MilitaryAsset"("assetType");

-- CreateIndex
CREATE INDEX "MilitaryAsset_status_idx" ON "MilitaryAsset"("status");

-- CreateIndex
CREATE INDEX "SecurityThreat_countryId_idx" ON "SecurityThreat"("countryId");

-- CreateIndex
CREATE INDEX "SecurityThreat_threatType_idx" ON "SecurityThreat"("threatType");

-- CreateIndex
CREATE INDEX "SecurityThreat_severity_idx" ON "SecurityThreat"("severity");

-- CreateIndex
CREATE INDEX "SecurityThreat_isActive_idx" ON "SecurityThreat"("isActive");

-- CreateIndex
CREATE INDEX "SecurityThreat_userId_idx" ON "SecurityThreat"("userId");

-- CreateIndex
CREATE INDEX "ThreatIncident_threatId_idx" ON "ThreatIncident"("threatId");

-- CreateIndex
CREATE INDEX "ThreatIncident_occurredAt_idx" ON "ThreatIncident"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DefenseBudget_countryId_key" ON "DefenseBudget"("countryId");

-- CreateIndex
CREATE INDEX "DefenseBudget_countryId_idx" ON "DefenseBudget"("countryId");

-- CreateIndex
CREATE INDEX "DefenseBudget_fiscalYear_idx" ON "DefenseBudget"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAssessment_countryId_key" ON "SecurityAssessment"("countryId");

-- CreateIndex
CREATE INDEX "SecurityAssessment_countryId_idx" ON "SecurityAssessment"("countryId");

-- CreateIndex
CREATE INDEX "SecurityAssessment_securityLevel_idx" ON "SecurityAssessment"("securityLevel");

-- CreateIndex
CREATE UNIQUE INDEX "InternalStabilityMetrics_countryId_key" ON "InternalStabilityMetrics"("countryId");

-- CreateIndex
CREATE INDEX "InternalStabilityMetrics_countryId_idx" ON "InternalStabilityMetrics"("countryId");

-- CreateIndex
CREATE INDEX "SecurityEvent_countryId_idx" ON "SecurityEvent"("countryId");

-- CreateIndex
CREATE INDEX "SecurityEvent_status_idx" ON "SecurityEvent"("status");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "BorderSecurity_countryId_key" ON "BorderSecurity"("countryId");

-- CreateIndex
CREATE INDEX "BorderSecurity_countryId_idx" ON "BorderSecurity"("countryId");

-- CreateIndex
CREATE INDEX "NeighborThreatAssessment_borderSecurityId_idx" ON "NeighborThreatAssessment"("borderSecurityId");

-- CreateIndex
CREATE INDEX "CountryFollow_followerCountryId_idx" ON "CountryFollow"("followerCountryId");

-- CreateIndex
CREATE INDEX "CountryFollow_followedCountryId_idx" ON "CountryFollow"("followedCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "CountryFollow_followerCountryId_followedCountryId_key" ON "CountryFollow"("followerCountryId", "followedCountryId");

-- CreateIndex
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");

-- CreateIndex
CREATE INDEX "SystemLog_category_idx" ON "SystemLog"("category");

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_countryId_idx" ON "SystemLog"("countryId");

-- CreateIndex
CREATE INDEX "SystemLog_timestamp_idx" ON "SystemLog"("timestamp");

-- CreateIndex
CREATE INDEX "SystemLog_requestId_idx" ON "SystemLog"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "LogRetentionPolicy_logLevel_key" ON "LogRetentionPolicy"("logLevel");

-- CreateIndex
CREATE UNIQUE INDEX "WikiCache_key_key" ON "WikiCache"("key");

-- CreateIndex
CREATE INDEX "WikiCache_key_idx" ON "WikiCache"("key");

-- CreateIndex
CREATE INDEX "WikiCache_type_countryName_idx" ON "WikiCache"("type", "countryName");

-- CreateIndex
CREATE INDEX "WikiCache_expiresAt_idx" ON "WikiCache"("expiresAt");

-- CreateIndex
CREATE INDEX "WikiCache_countryName_idx" ON "WikiCache"("countryName");
