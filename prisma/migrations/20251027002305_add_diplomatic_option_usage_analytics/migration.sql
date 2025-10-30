-- DropIndex
DROP INDEX "User_countryId_key";

-- AlterTable
ALTER TABLE "Embassy" ADD COLUMN "description" TEXT;
ALTER TABLE "Embassy" ADD COLUMN "keyAchievements" TEXT;
ALTER TABLE "Embassy" ADD COLUMN "partnershipGoals" TEXT;
ALTER TABLE "Embassy" ADD COLUMN "strategicPriorities" TEXT;

-- CreateTable
CREATE TABLE "CulturalScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "country1Id" TEXT NOT NULL,
    "country2Id" TEXT NOT NULL,
    "country1Name" TEXT NOT NULL,
    "country2Name" TEXT NOT NULL,
    "relationshipState" TEXT NOT NULL,
    "relationshipStrength" REAL NOT NULL,
    "responseOptions" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "culturalImpact" REAL NOT NULL,
    "diplomaticRisk" REAL NOT NULL,
    "economicCost" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "chosenOption" TEXT,
    "actualCulturalImpact" REAL,
    "actualDiplomaticImpact" REAL,
    "actualEconomicCost" REAL,
    "outcomeNotes" TEXT
);

-- CreateTable
CREATE TABLE "CulturalExchangeOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "responseChoice" TEXT NOT NULL,
    "culturalImpactChange" REAL NOT NULL,
    "diplomaticChange" REAL NOT NULL,
    "economicCostActual" REAL NOT NULL,
    "participantSatisfaction" REAL NOT NULL,
    "publicPerception" REAL NOT NULL,
    "relationshipStateBefore" TEXT NOT NULL,
    "relationshipStateAfter" TEXT NOT NULL,
    "stateChanged" BOOLEAN NOT NULL,
    "transitionProbability" REAL NOT NULL,
    "relationshipStrengthDelta" REAL NOT NULL,
    "culturalBonusDelta" REAL NOT NULL,
    "diplomaticBonusDelta" REAL NOT NULL,
    "culturalTiesStrength" REAL NOT NULL,
    "softPowerGain" REAL NOT NULL,
    "peopleTopeopleBonds" REAL NOT NULL,
    "impactReasoning" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CulturalExchangeOutcome_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "CulturalExchange" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CulturalExchangeVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "comment" TEXT,
    "votedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CulturalExchangeVote_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "CulturalExchange" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiplomaticOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiplomaticOptionUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "optionId" TEXT NOT NULL,
    "embassyId" TEXT NOT NULL,
    "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "DiplomaticOptionUsage_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "DiplomaticOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiplomaticOptionUsage_embassyId_fkey" FOREIGN KEY ("embassyId") REFERENCES "Embassy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportType" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "summaryTemplate" TEXT NOT NULL,
    "findingsTemplate" TEXT NOT NULL,
    "minimumLevel" INTEGER NOT NULL,
    "confidenceBase" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalApiCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "countryName" TEXT,
    "metadata" TEXT,
    "contentHash" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastValidatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationStatus" TEXT NOT NULL DEFAULT 'valid',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EconomicArchetype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "era" TEXT NOT NULL,
    "characteristics" TEXT NOT NULL,
    "economicComponents" TEXT NOT NULL,
    "governmentComponents" TEXT NOT NULL,
    "taxProfile" TEXT NOT NULL,
    "sectorFocus" TEXT NOT NULL,
    "employmentProfile" TEXT NOT NULL,
    "growthMetrics" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "challenges" TEXT NOT NULL,
    "culturalFactors" TEXT NOT NULL,
    "modernExamples" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "implementationComplexity" TEXT NOT NULL,
    "historicalContext" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CulturalExchange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "narrative" TEXT,
    "objectives" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "maxParticipants" INTEGER,
    "hostCountryId" TEXT NOT NULL,
    "hostCountryName" TEXT NOT NULL,
    "hostCountryFlag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "ixTimeContext" REAL NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 0,
    "culturalImpact" REAL NOT NULL DEFAULT 0,
    "diplomaticValue" REAL NOT NULL DEFAULT 0,
    "socialEngagement" INTEGER NOT NULL DEFAULT 0,
    "achievements" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scenarioType" TEXT,
    "scenarioId" TEXT,
    "markovStateImpact" TEXT,
    "npcResponses" TEXT,
    "predictedOutcome" TEXT,
    "participantSatisfaction" REAL NOT NULL DEFAULT 50,
    "publicPerception" REAL NOT NULL DEFAULT 50,
    "economicCost" REAL NOT NULL DEFAULT 0,
    "culturalBonusDelta" REAL NOT NULL DEFAULT 0,
    "diplomaticBonusDelta" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "CulturalExchange_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "CulturalScenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CulturalExchange" ("achievements", "createdAt", "culturalImpact", "description", "diplomaticValue", "endDate", "hostCountryFlag", "hostCountryId", "hostCountryName", "id", "ixTimeContext", "participants", "socialEngagement", "startDate", "status", "title", "type", "updatedAt") SELECT "achievements", "createdAt", "culturalImpact", "description", "diplomaticValue", "endDate", "hostCountryFlag", "hostCountryId", "hostCountryName", "id", "ixTimeContext", "participants", "socialEngagement", "startDate", "status", "title", "type", "updatedAt" FROM "CulturalExchange";
DROP TABLE "CulturalExchange";
ALTER TABLE "new_CulturalExchange" RENAME TO "CulturalExchange";
CREATE INDEX "CulturalExchange_hostCountryId_idx" ON "CulturalExchange"("hostCountryId");
CREATE INDEX "CulturalExchange_type_idx" ON "CulturalExchange"("type");
CREATE INDEX "CulturalExchange_status_idx" ON "CulturalExchange"("status");
CREATE INDEX "CulturalExchange_startDate_idx" ON "CulturalExchange"("startDate");
CREATE INDEX "CulturalExchange_scenarioType_idx" ON "CulturalExchange"("scenarioType");
CREATE INDEX "CulturalExchange_scenarioId_idx" ON "CulturalExchange"("scenarioId");
CREATE TABLE "new_CulturalExchangeParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "flagUrl" TEXT,
    "role" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isNPC" BOOLEAN NOT NULL DEFAULT false,
    "enthusiasmLevel" REAL,
    "resourceCommitment" REAL,
    "participationDecision" TEXT,
    "npcPersonalityArchetype" TEXT,
    CONSTRAINT "CulturalExchangeParticipant_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "CulturalExchange" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CulturalExchangeParticipant" ("countryId", "countryName", "exchangeId", "flagUrl", "id", "joinedAt", "role") SELECT "countryId", "countryName", "exchangeId", "flagUrl", "id", "joinedAt", "role" FROM "CulturalExchangeParticipant";
DROP TABLE "CulturalExchangeParticipant";
ALTER TABLE "new_CulturalExchangeParticipant" RENAME TO "CulturalExchangeParticipant";
CREATE INDEX "CulturalExchangeParticipant_exchangeId_idx" ON "CulturalExchangeParticipant"("exchangeId");
CREATE INDEX "CulturalExchangeParticipant_countryId_idx" ON "CulturalExchangeParticipant"("countryId");
CREATE UNIQUE INDEX "CulturalExchangeParticipant_exchangeId_countryId_key" ON "CulturalExchangeParticipant"("exchangeId", "countryId");
CREATE TABLE "new_EmbassyMission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "embassyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "requiredStaff" INTEGER NOT NULL DEFAULT 1,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "requiredSpecialization" TEXT,
    "cost" REAL NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 7,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completesAt" DATETIME NOT NULL,
    "experienceReward" INTEGER NOT NULL DEFAULT 0,
    "influenceReward" REAL NOT NULL DEFAULT 0,
    "reputationReward" REAL NOT NULL DEFAULT 0,
    "economicReward" REAL NOT NULL DEFAULT 0,
    "progress" REAL NOT NULL DEFAULT 0,
    "successChance" REAL NOT NULL DEFAULT 50,
    "complications" TEXT,
    "ixTimeStarted" REAL NOT NULL,
    "ixTimeCompletes" REAL NOT NULL,
    "culturalExchangeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmbassyMission_embassyId_fkey" FOREIGN KEY ("embassyId") REFERENCES "Embassy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmbassyMission_culturalExchangeId_fkey" FOREIGN KEY ("culturalExchangeId") REFERENCES "CulturalExchange" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmbassyMission" ("completesAt", "complications", "cost", "createdAt", "description", "difficulty", "duration", "economicReward", "embassyId", "experienceReward", "id", "influenceReward", "ixTimeCompletes", "ixTimeStarted", "name", "progress", "reputationReward", "requiredLevel", "requiredSpecialization", "requiredStaff", "startedAt", "status", "successChance", "type", "updatedAt") SELECT "completesAt", "complications", "cost", "createdAt", "description", "difficulty", "duration", "economicReward", "embassyId", "experienceReward", "id", "influenceReward", "ixTimeCompletes", "ixTimeStarted", "name", "progress", "reputationReward", "requiredLevel", "requiredSpecialization", "requiredStaff", "startedAt", "status", "successChance", "type", "updatedAt" FROM "EmbassyMission";
DROP TABLE "EmbassyMission";
ALTER TABLE "new_EmbassyMission" RENAME TO "EmbassyMission";
CREATE INDEX "EmbassyMission_embassyId_idx" ON "EmbassyMission"("embassyId");
CREATE INDEX "EmbassyMission_type_idx" ON "EmbassyMission"("type");
CREATE INDEX "EmbassyMission_status_idx" ON "EmbassyMission"("status");
CREATE INDEX "EmbassyMission_completesAt_idx" ON "EmbassyMission"("completesAt");
CREATE INDEX "EmbassyMission_culturalExchangeId_idx" ON "EmbassyMission"("culturalExchangeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CulturalScenario_country1Id_idx" ON "CulturalScenario"("country1Id");

-- CreateIndex
CREATE INDEX "CulturalScenario_country2Id_idx" ON "CulturalScenario"("country2Id");

-- CreateIndex
CREATE INDEX "CulturalScenario_type_idx" ON "CulturalScenario"("type");

-- CreateIndex
CREATE INDEX "CulturalScenario_status_idx" ON "CulturalScenario"("status");

-- CreateIndex
CREATE INDEX "CulturalScenario_createdAt_idx" ON "CulturalScenario"("createdAt");

-- CreateIndex
CREATE INDEX "CulturalScenario_expiresAt_idx" ON "CulturalScenario"("expiresAt");

-- CreateIndex
CREATE INDEX "CulturalExchangeOutcome_exchangeId_idx" ON "CulturalExchangeOutcome"("exchangeId");

-- CreateIndex
CREATE INDEX "CulturalExchangeOutcome_countryId_idx" ON "CulturalExchangeOutcome"("countryId");

-- CreateIndex
CREATE INDEX "CulturalExchangeOutcome_createdAt_idx" ON "CulturalExchangeOutcome"("createdAt");

-- CreateIndex
CREATE INDEX "CulturalExchangeVote_exchangeId_idx" ON "CulturalExchangeVote"("exchangeId");

-- CreateIndex
CREATE INDEX "CulturalExchangeVote_countryId_idx" ON "CulturalExchangeVote"("countryId");

-- CreateIndex
CREATE INDEX "CulturalExchangeVote_vote_idx" ON "CulturalExchangeVote"("vote");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExchangeVote_exchangeId_countryId_key" ON "CulturalExchangeVote"("exchangeId", "countryId");

-- CreateIndex
CREATE INDEX "DiplomaticOption_type_isActive_idx" ON "DiplomaticOption"("type", "isActive");

-- CreateIndex
CREATE INDEX "DiplomaticOption_category_idx" ON "DiplomaticOption"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DiplomaticOption_type_value_key" ON "DiplomaticOption"("type", "value");

-- CreateIndex
CREATE INDEX "DiplomaticOptionUsage_optionId_idx" ON "DiplomaticOptionUsage"("optionId");

-- CreateIndex
CREATE INDEX "DiplomaticOptionUsage_embassyId_idx" ON "DiplomaticOptionUsage"("embassyId");

-- CreateIndex
CREATE INDEX "DiplomaticOptionUsage_selectedAt_idx" ON "DiplomaticOptionUsage"("selectedAt");

-- CreateIndex
CREATE INDEX "IntelligenceTemplate_reportType_isActive_idx" ON "IntelligenceTemplate"("reportType", "isActive");

-- CreateIndex
CREATE INDEX "IntelligenceTemplate_minimumLevel_idx" ON "IntelligenceTemplate"("minimumLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalApiCache_key_key" ON "ExternalApiCache"("key");

-- CreateIndex
CREATE INDEX "ExternalApiCache_key_idx" ON "ExternalApiCache"("key");

-- CreateIndex
CREATE INDEX "ExternalApiCache_service_type_identifier_idx" ON "ExternalApiCache"("service", "type", "identifier");

-- CreateIndex
CREATE INDEX "ExternalApiCache_service_countryName_idx" ON "ExternalApiCache"("service", "countryName");

-- CreateIndex
CREATE INDEX "ExternalApiCache_expiresAt_idx" ON "ExternalApiCache"("expiresAt");

-- CreateIndex
CREATE INDEX "ExternalApiCache_lastValidatedAt_idx" ON "ExternalApiCache"("lastValidatedAt");

-- CreateIndex
CREATE INDEX "ExternalApiCache_validationStatus_idx" ON "ExternalApiCache"("validationStatus");

-- CreateIndex
CREATE INDEX "ExternalApiCache_countryName_idx" ON "ExternalApiCache"("countryName");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicArchetype_key_key" ON "EconomicArchetype"("key");

-- CreateIndex
CREATE INDEX "EconomicArchetype_key_idx" ON "EconomicArchetype"("key");

-- CreateIndex
CREATE INDEX "EconomicArchetype_era_idx" ON "EconomicArchetype"("era");

-- CreateIndex
CREATE INDEX "EconomicArchetype_region_idx" ON "EconomicArchetype"("region");

-- CreateIndex
CREATE INDEX "EconomicArchetype_isActive_idx" ON "EconomicArchetype"("isActive");

-- CreateIndex
CREATE INDEX "EconomicArchetype_usageCount_idx" ON "EconomicArchetype"("usageCount");
