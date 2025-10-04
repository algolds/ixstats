/*
  Warnings:

  - You are about to drop the `AccountPresence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ThinkpagesAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `accountId` on the `ConversationParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `MessageReadReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `mentionedAccountId` on the `PostMention` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `PostReaction` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `ThinkpagesPost` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `ThinkshareMessage` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `ThinktankMember` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `ThinktankMessage` table. All the data in the column will be lost.
  - Added the required column `userId` to the `ConversationParticipant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `MessageReadReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mentionedUserId` to the `PostMention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PostReaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ThinkpagesPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ThinkshareMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ThinktankMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ThinktankMessage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AccountPresence_lastSeen_idx";

-- DropIndex
DROP INDEX "AccountPresence_isOnline_idx";

-- DropIndex
DROP INDEX "AccountPresence_accountId_key";

-- DropIndex
DROP INDEX "ThinkpagesAccount_verified_idx";

-- DropIndex
DROP INDEX "ThinkpagesAccount_username_idx";

-- DropIndex
DROP INDEX "ThinkpagesAccount_accountType_idx";

-- DropIndex
DROP INDEX "ThinkpagesAccount_countryId_idx";

-- DropIndex
DROP INDEX "ThinkpagesAccount_username_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AccountPresence";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ThinkpagesAccount";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "GovernmentComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "effectivenessScore" REAL NOT NULL DEFAULT 50,
    "implementationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "implementationCost" REAL NOT NULL DEFAULT 0,
    "maintenanceCost" REAL NOT NULL DEFAULT 0,
    "requiredCapacity" REAL NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GovernmentComponent_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentSynergy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "primaryComponentId" TEXT NOT NULL,
    "secondaryComponentId" TEXT NOT NULL,
    "synergyType" TEXT NOT NULL,
    "effectMultiplier" REAL NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComponentSynergy_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentSynergy_primaryComponentId_fkey" FOREIGN KEY ("primaryComponentId") REFERENCES "GovernmentComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComponentSynergy_secondaryComponentId_fkey" FOREIGN KEY ("secondaryComponentId") REFERENCES "GovernmentComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalBudget" REAL NOT NULL,
    "assumptions" TEXT,
    "riskLevel" TEXT NOT NULL,
    "feasibility" REAL NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetScenario_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetScenarioCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "allocatedAmount" REAL NOT NULL,
    "allocatedPercent" REAL NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "efficiency" REAL NOT NULL DEFAULT 50,
    "performance" REAL NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetScenarioCategory_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "BudgetScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FiscalPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "impact" REAL NOT NULL,
    "implementation" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "benefits" REAL NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "appliedDate" DATETIME,
    "expiryDate" DATETIME,
    "measuredImpact" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FiscalPolicy_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtomicEffectiveness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "overallScore" REAL NOT NULL,
    "taxEffectiveness" REAL NOT NULL,
    "economicPolicyScore" REAL NOT NULL,
    "stabilityScore" REAL NOT NULL,
    "legitimacyScore" REAL NOT NULL,
    "componentCount" INTEGER NOT NULL DEFAULT 0,
    "synergyBonus" REAL NOT NULL DEFAULT 0,
    "conflictPenalty" REAL NOT NULL DEFAULT 0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AtomicEffectiveness_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtomicEconomicImpact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "economicMetric" TEXT NOT NULL,
    "impactMultiplier" REAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtomicEconomicImpact_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPresence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'available',
    "customStatus" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "panelType" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "iconName" TEXT,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GovernmentOfficial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "governmentStructureId" TEXT,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "appointedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termEndDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "responsibilities" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GovernmentOfficial_governmentStructureId_fkey" FOREIGN KEY ("governmentStructureId") REFERENCES "GovernmentStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GovernmentOfficial_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "GovernmentDepartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CabinetMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" DATETIME NOT NULL,
    "scheduledIxTime" REAL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MeetingAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "officialId" TEXT,
    "attendeeName" TEXT NOT NULL,
    "attendeeRole" TEXT,
    "attendanceStatus" TEXT NOT NULL DEFAULT 'invited',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CabinetMeeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingAttendance_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "GovernmentOfficial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingAgendaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "category" TEXT,
    "tags" TEXT,
    "relatedMetrics" TEXT,
    "presenter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outcome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CabinetMeeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "impact" TEXT,
    "votingResult" TEXT,
    "implementationStatus" TEXT NOT NULL DEFAULT 'pending',
    "relatedPolicyId" TEXT,
    "relatedMetrics" TEXT,
    "estimatedEffect" TEXT,
    "decisionMakers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CabinetMeeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "decisionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT,
    "dueDate" DATETIME,
    "dueIxTime" REAL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "category" TEXT,
    "tags" TEXT,
    "completionNotes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CabinetMeeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "objectives" TEXT,
    "targetMetrics" TEXT,
    "implementationCost" REAL NOT NULL DEFAULT 0,
    "maintenanceCost" REAL NOT NULL DEFAULT 0,
    "estimatedBenefit" TEXT,
    "recommendedFor" TEXT,
    "requiredTier" TEXT,
    "requiredComponents" TEXT,
    "conflictsWith" TEXT,
    "prerequisitePolicies" TEXT,
    "proposedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" DATETIME,
    "expiryDate" DATETIME,
    "proposedIxTime" REAL,
    "effectiveIxTime" REAL,
    "gdpEffect" REAL NOT NULL DEFAULT 0,
    "employmentEffect" REAL NOT NULL DEFAULT 0,
    "inflationEffect" REAL NOT NULL DEFAULT 0,
    "taxRevenueEffect" REAL NOT NULL DEFAULT 0,
    "customEffects" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedDate" DATETIME,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PolicyEffectLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedIxTime" REAL NOT NULL,
    "effectType" TEXT NOT NULL,
    "metricsBefore" TEXT,
    "metricsAfter" TEXT,
    "actualEffect" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyEffectLog_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" DATETIME NOT NULL,
    "scheduledIxTime" REAL,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "category" TEXT,
    "tags" TEXT,
    "relatedIds" TEXT,
    "recurrence" TEXT,
    "reminderSettings" TEXT,
    "completionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuickActionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultSettings" TEXT,
    "requiredFields" TEXT,
    "optionalFields" TEXT,
    "estimatedDuration" TEXT,
    "recommendedFor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CollaborativeDoc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "lastEditBy" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollaborativeDoc_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollaborativeDoc" ("content", "createdAt", "createdBy", "groupId", "id", "isPublic", "lastEditBy", "title", "updatedAt", "version") SELECT "content", "createdAt", "createdBy", "groupId", "id", "isPublic", "lastEditBy", "title", "updatedAt", "version" FROM "CollaborativeDoc";
DROP TABLE "CollaborativeDoc";
ALTER TABLE "new_CollaborativeDoc" RENAME TO "CollaborativeDoc";
CREATE INDEX "CollaborativeDoc_groupId_idx" ON "CollaborativeDoc"("groupId");
CREATE INDEX "CollaborativeDoc_createdBy_idx" ON "CollaborativeDoc"("createdBy");
CREATE INDEX "CollaborativeDoc_isPublic_idx" ON "CollaborativeDoc"("isPublic");
CREATE TABLE "new_ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationSettings" TEXT,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ThinkshareConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ConversationParticipant" ("conversationId", "id", "isActive", "joinedAt", "lastReadAt", "leftAt", "notificationSettings", "role") SELECT "conversationId", "id", "isActive", "joinedAt", "lastReadAt", "leftAt", "notificationSettings", "role" FROM "ConversationParticipant";
DROP TABLE "ConversationParticipant";
ALTER TABLE "new_ConversationParticipant" RENAME TO "ConversationParticipant";
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE TABLE "new_Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
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
    "usesAtomicGovernment" BOOLEAN NOT NULL DEFAULT true,
    "hideDiplomaticOps" BOOLEAN NOT NULL DEFAULT false,
    "hideStratcommIntel" BOOLEAN NOT NULL DEFAULT false,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baselineDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Country" ("actualGdpGrowth", "adjustedGdpGrowth", "areaSqMi", "averageAnnualIncome", "averageWorkweekHours", "baselineDate", "baselineGdpPerCapita", "baselinePopulation", "budgetDeficitSurplus", "coatOfArms", "continent", "createdAt", "currencyExchangeRate", "currentGdpPerCapita", "currentPopulation", "currentTotalGdp", "debtPerCapita", "debtServiceCosts", "economicTier", "employmentRate", "externalDebtGDPPercent", "flag", "gdpDensity", "governmentBudgetGDPPercent", "governmentRevenueTotal", "governmentType", "id", "incomeInequalityGini", "inflationRate", "interestRates", "internalDebtGDPPercent", "laborForceParticipationRate", "landArea", "lastCalculated", "leader", "lifeExpectancy", "literacyRate", "localGrowthFactor", "maxGdpGrowthRate", "minimumWage", "name", "nominalGDP", "populationDensity", "populationGrowthRate", "populationTier", "povertyRate", "projected2040Gdp", "projected2040GdpPerCapita", "projected2040Population", "realGDPGrowthRate", "region", "religion", "ruralPopulationPercent", "socialMobilityIndex", "spendingGDPPercent", "spendingPerCapita", "taxRevenueGDPPercent", "taxRevenuePerCapita", "totalDebtGDPRatio", "totalGovernmentSpending", "totalWorkforce", "unemploymentRate", "updatedAt", "urbanPopulationPercent") SELECT "actualGdpGrowth", "adjustedGdpGrowth", "areaSqMi", "averageAnnualIncome", "averageWorkweekHours", "baselineDate", "baselineGdpPerCapita", "baselinePopulation", "budgetDeficitSurplus", "coatOfArms", "continent", "createdAt", "currencyExchangeRate", "currentGdpPerCapita", "currentPopulation", "currentTotalGdp", "debtPerCapita", "debtServiceCosts", "economicTier", "employmentRate", "externalDebtGDPPercent", "flag", "gdpDensity", "governmentBudgetGDPPercent", "governmentRevenueTotal", "governmentType", "id", "incomeInequalityGini", "inflationRate", "interestRates", "internalDebtGDPPercent", "laborForceParticipationRate", "landArea", "lastCalculated", "leader", "lifeExpectancy", "literacyRate", "localGrowthFactor", "maxGdpGrowthRate", "minimumWage", "name", "nominalGDP", "populationDensity", "populationGrowthRate", "populationTier", "povertyRate", "projected2040Gdp", "projected2040GdpPerCapita", "projected2040Population", "realGDPGrowthRate", "region", "religion", "ruralPopulationPercent", "socialMobilityIndex", "spendingGDPPercent", "spendingPerCapita", "taxRevenueGDPPercent", "taxRevenuePerCapita", "totalDebtGDPRatio", "totalGovernmentSpending", "totalWorkforce", "unemploymentRate", "updatedAt", "urbanPopulationPercent" FROM "Country";
DROP TABLE "Country";
ALTER TABLE "new_Country" RENAME TO "Country";
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");
CREATE INDEX "Country_name_idx" ON "Country"("name");
CREATE INDEX "Country_economicTier_idx" ON "Country"("economicTier");
CREATE INDEX "Country_populationTier_idx" ON "Country"("populationTier");
CREATE INDEX "Country_continent_idx" ON "Country"("continent");
CREATE INDEX "Country_region_idx" ON "Country"("region");
CREATE TABLE "new_MessageReadReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageType" TEXT NOT NULL,
    CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ThinktankMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ThinkshareMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageReadReceipt" ("id", "messageId", "messageType", "readAt") SELECT "id", "messageId", "messageType", "readAt" FROM "MessageReadReceipt";
DROP TABLE "MessageReadReceipt";
ALTER TABLE "new_MessageReadReceipt" RENAME TO "MessageReadReceipt";
CREATE INDEX "MessageReadReceipt_messageId_idx" ON "MessageReadReceipt"("messageId");
CREATE INDEX "MessageReadReceipt_userId_idx" ON "MessageReadReceipt"("userId");
CREATE INDEX "MessageReadReceipt_messageType_idx" ON "MessageReadReceipt"("messageType");
CREATE UNIQUE INDEX "MessageReadReceipt_messageId_userId_key" ON "MessageReadReceipt"("messageId", "userId");
CREATE TABLE "new_PostMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PostMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostMention" ("id", "position", "postId") SELECT "id", "position", "postId" FROM "PostMention";
DROP TABLE "PostMention";
ALTER TABLE "new_PostMention" RENAME TO "PostMention";
CREATE INDEX "PostMention_postId_idx" ON "PostMention"("postId");
CREATE INDEX "PostMention_mentionedUserId_idx" ON "PostMention"("mentionedUserId");
CREATE TABLE "new_PostReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostReaction" ("id", "postId", "reactionType", "timestamp") SELECT "id", "postId", "reactionType", "timestamp" FROM "PostReaction";
DROP TABLE "PostReaction";
ALTER TABLE "new_PostReaction" RENAME TO "PostReaction";
CREATE INDEX "PostReaction_postId_idx" ON "PostReaction"("postId");
CREATE INDEX "PostReaction_userId_idx" ON "PostReaction"("userId");
CREATE INDEX "PostReaction_reactionType_idx" ON "PostReaction"("reactionType");
CREATE UNIQUE INDEX "PostReaction_postId_userId_key" ON "PostReaction"("postId", "userId");
CREATE TABLE "new_ThinkpagesPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hashtags" TEXT,
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
    CONSTRAINT "ThinkpagesPost_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "ThinkpagesPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ThinkpagesPost_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "ThinkpagesPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThinkpagesPost" ("content", "createdAt", "hashtags", "id", "impressions", "ixTimeTimestamp", "likeCount", "parentPostId", "pinned", "postType", "reactionCounts", "replyCount", "repostCount", "repostOfId", "trending", "updatedAt", "visibility") SELECT "content", "createdAt", "hashtags", "id", "impressions", "ixTimeTimestamp", "likeCount", "parentPostId", "pinned", "postType", "reactionCounts", "replyCount", "repostCount", "repostOfId", "trending", "updatedAt", "visibility" FROM "ThinkpagesPost";
DROP TABLE "ThinkpagesPost";
ALTER TABLE "new_ThinkpagesPost" RENAME TO "ThinkpagesPost";
CREATE INDEX "ThinkpagesPost_userId_idx" ON "ThinkpagesPost"("userId");
CREATE INDEX "ThinkpagesPost_ixTimeTimestamp_idx" ON "ThinkpagesPost"("ixTimeTimestamp");
CREATE INDEX "ThinkpagesPost_trending_idx" ON "ThinkpagesPost"("trending");
CREATE INDEX "ThinkpagesPost_visibility_idx" ON "ThinkpagesPost"("visibility");
CREATE INDEX "ThinkpagesPost_postType_idx" ON "ThinkpagesPost"("postType");
CREATE INDEX "ThinkpagesPost_parentPostId_idx" ON "ThinkpagesPost"("parentPostId");
CREATE TABLE "new_ThinkshareMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "replyToId" TEXT,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "reactions" TEXT,
    "mentions" TEXT,
    "attachments" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "ixTimeTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThinkshareMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ThinkshareConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinkshareMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ThinkshareMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThinkshareMessage" ("attachments", "content", "conversationId", "deletedAt", "editedAt", "id", "isSystem", "ixTimeTimestamp", "mentions", "messageType", "reactions", "replyToId") SELECT "attachments", "content", "conversationId", "deletedAt", "editedAt", "id", "isSystem", "ixTimeTimestamp", "mentions", "messageType", "reactions", "replyToId" FROM "ThinkshareMessage";
DROP TABLE "ThinkshareMessage";
ALTER TABLE "new_ThinkshareMessage" RENAME TO "ThinkshareMessage";
CREATE INDEX "ThinkshareMessage_conversationId_idx" ON "ThinkshareMessage"("conversationId");
CREATE INDEX "ThinkshareMessage_userId_idx" ON "ThinkshareMessage"("userId");
CREATE INDEX "ThinkshareMessage_ixTimeTimestamp_idx" ON "ThinkshareMessage"("ixTimeTimestamp");
CREATE INDEX "ThinkshareMessage_messageType_idx" ON "ThinkshareMessage"("messageType");
CREATE TABLE "new_ThinktankGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "type" TEXT NOT NULL DEFAULT 'public',
    "category" TEXT,
    "tags" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ThinktankGroup" ("avatar", "category", "createdAt", "createdBy", "description", "id", "isActive", "memberCount", "name", "settings", "tags", "type", "updatedAt") SELECT "avatar", "category", "createdAt", "createdBy", "description", "id", "isActive", "memberCount", "name", "settings", "tags", "type", "updatedAt" FROM "ThinktankGroup";
DROP TABLE "ThinktankGroup";
ALTER TABLE "new_ThinktankGroup" RENAME TO "ThinktankGroup";
CREATE INDEX "ThinktankGroup_type_idx" ON "ThinktankGroup"("type");
CREATE INDEX "ThinktankGroup_category_idx" ON "ThinktankGroup"("category");
CREATE INDEX "ThinktankGroup_createdBy_idx" ON "ThinktankGroup"("createdBy");
CREATE INDEX "ThinktankGroup_isActive_idx" ON "ThinktankGroup"("isActive");
CREATE TABLE "new_ThinktankInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "invitedUser" TEXT,
    "inviteCode" TEXT,
    "expiresAt" DATETIME,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThinktankInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ThinktankInvite" ("createdAt", "expiresAt", "groupId", "id", "inviteCode", "invitedBy", "invitedUser", "isUsed") SELECT "createdAt", "expiresAt", "groupId", "id", "inviteCode", "invitedBy", "invitedUser", "isUsed" FROM "ThinktankInvite";
DROP TABLE "ThinktankInvite";
ALTER TABLE "new_ThinktankInvite" RENAME TO "ThinktankInvite";
CREATE INDEX "ThinktankInvite_groupId_idx" ON "ThinktankInvite"("groupId");
CREATE INDEX "ThinktankInvite_invitedBy_idx" ON "ThinktankInvite"("invitedBy");
CREATE INDEX "ThinktankInvite_inviteCode_idx" ON "ThinktankInvite"("inviteCode");
CREATE TABLE "new_ThinktankMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT,
    CONSTRAINT "ThinktankMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ThinktankMember" ("groupId", "id", "isActive", "joinedAt", "permissions", "role") SELECT "groupId", "id", "isActive", "joinedAt", "permissions", "role" FROM "ThinktankMember";
DROP TABLE "ThinktankMember";
ALTER TABLE "new_ThinktankMember" RENAME TO "ThinktankMember";
CREATE INDEX "ThinktankMember_groupId_idx" ON "ThinktankMember"("groupId");
CREATE INDEX "ThinktankMember_userId_idx" ON "ThinktankMember"("userId");
CREATE INDEX "ThinktankMember_role_idx" ON "ThinktankMember"("role");
CREATE UNIQUE INDEX "ThinktankMember_groupId_userId_key" ON "ThinktankMember"("groupId", "userId");
CREATE TABLE "new_ThinktankMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "replyToId" TEXT,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "reactions" TEXT,
    "mentions" TEXT,
    "attachments" TEXT,
    "ixTimeTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThinktankMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinktankMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ThinktankMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThinktankMessage" ("attachments", "content", "deletedAt", "editedAt", "groupId", "id", "ixTimeTimestamp", "mentions", "messageType", "reactions", "replyToId") SELECT "attachments", "content", "deletedAt", "editedAt", "groupId", "id", "ixTimeTimestamp", "mentions", "messageType", "reactions", "replyToId" FROM "ThinktankMessage";
DROP TABLE "ThinktankMessage";
ALTER TABLE "new_ThinktankMessage" RENAME TO "ThinktankMessage";
CREATE INDEX "ThinktankMessage_groupId_idx" ON "ThinktankMessage"("groupId");
CREATE INDEX "ThinktankMessage_userId_idx" ON "ThinktankMessage"("userId");
CREATE INDEX "ThinktankMessage_ixTimeTimestamp_idx" ON "ThinktankMessage"("ixTimeTimestamp");
CREATE INDEX "ThinktankMessage_messageType_idx" ON "ThinktankMessage"("messageType");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "countryId" TEXT,
    "roleId" TEXT,
    "membershipTier" TEXT NOT NULL DEFAULT 'basic',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("clerkUserId", "countryId", "createdAt", "id", "isActive", "roleId", "updatedAt") SELECT "clerkUserId", "countryId", "createdAt", "id", "isActive", "roleId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
CREATE UNIQUE INDEX "User_countryId_key" ON "User"("countryId");
CREATE INDEX "User_clerkUserId_idx" ON "User"("clerkUserId");
CREATE INDEX "User_countryId_idx" ON "User"("countryId");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "User_membershipTier_idx" ON "User"("membershipTier");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GovernmentComponent_countryId_idx" ON "GovernmentComponent"("countryId");

-- CreateIndex
CREATE INDEX "GovernmentComponent_componentType_idx" ON "GovernmentComponent"("componentType");

-- CreateIndex
CREATE INDEX "GovernmentComponent_isActive_idx" ON "GovernmentComponent"("isActive");

-- CreateIndex
CREATE INDEX "ComponentSynergy_countryId_idx" ON "ComponentSynergy"("countryId");

-- CreateIndex
CREATE INDEX "ComponentSynergy_synergyType_idx" ON "ComponentSynergy"("synergyType");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentSynergy_primaryComponentId_secondaryComponentId_key" ON "ComponentSynergy"("primaryComponentId", "secondaryComponentId");

-- CreateIndex
CREATE INDEX "BudgetScenario_countryId_idx" ON "BudgetScenario"("countryId");

-- CreateIndex
CREATE INDEX "BudgetScenario_isActive_idx" ON "BudgetScenario"("isActive");

-- CreateIndex
CREATE INDEX "BudgetScenarioCategory_scenarioId_idx" ON "BudgetScenarioCategory"("scenarioId");

-- CreateIndex
CREATE INDEX "FiscalPolicy_countryId_idx" ON "FiscalPolicy"("countryId");

-- CreateIndex
CREATE INDEX "FiscalPolicy_policyType_idx" ON "FiscalPolicy"("policyType");

-- CreateIndex
CREATE INDEX "FiscalPolicy_isActive_idx" ON "FiscalPolicy"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AtomicEffectiveness_countryId_key" ON "AtomicEffectiveness"("countryId");

-- CreateIndex
CREATE INDEX "AtomicEffectiveness_countryId_idx" ON "AtomicEffectiveness"("countryId");

-- CreateIndex
CREATE INDEX "AtomicEffectiveness_overallScore_idx" ON "AtomicEffectiveness"("overallScore");

-- CreateIndex
CREATE INDEX "AtomicEffectiveness_lastCalculated_idx" ON "AtomicEffectiveness"("lastCalculated");

-- CreateIndex
CREATE INDEX "AtomicEconomicImpact_countryId_idx" ON "AtomicEconomicImpact"("countryId");

-- CreateIndex
CREATE INDEX "AtomicEconomicImpact_componentType_idx" ON "AtomicEconomicImpact"("componentType");

-- CreateIndex
CREATE INDEX "AtomicEconomicImpact_economicMetric_idx" ON "AtomicEconomicImpact"("economicMetric");

-- CreateIndex
CREATE INDEX "AtomicEconomicImpact_effectiveDate_idx" ON "AtomicEconomicImpact"("effectiveDate");

-- CreateIndex
CREATE INDEX "AtomicEconomicImpact_isActive_idx" ON "AtomicEconomicImpact"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_userId_key" ON "UserPresence"("userId");

-- CreateIndex
CREATE INDEX "UserPresence_isOnline_idx" ON "UserPresence"("isOnline");

-- CreateIndex
CREATE INDEX "UserPresence_lastSeen_idx" ON "UserPresence"("lastSeen");

-- CreateIndex
CREATE INDEX "AdminFavorite_userId_idx" ON "AdminFavorite"("userId");

-- CreateIndex
CREATE INDEX "AdminFavorite_category_idx" ON "AdminFavorite"("category");

-- CreateIndex
CREATE INDEX "AdminFavorite_isActive_idx" ON "AdminFavorite"("isActive");

-- CreateIndex
CREATE INDEX "AdminFavorite_order_idx" ON "AdminFavorite"("order");

-- CreateIndex
CREATE UNIQUE INDEX "AdminFavorite_userId_panelId_key" ON "AdminFavorite"("userId", "panelId");

-- CreateIndex
CREATE INDEX "GovernmentOfficial_governmentStructureId_idx" ON "GovernmentOfficial"("governmentStructureId");

-- CreateIndex
CREATE INDEX "GovernmentOfficial_departmentId_idx" ON "GovernmentOfficial"("departmentId");

-- CreateIndex
CREATE INDEX "GovernmentOfficial_isActive_idx" ON "GovernmentOfficial"("isActive");

-- CreateIndex
CREATE INDEX "GovernmentOfficial_role_idx" ON "GovernmentOfficial"("role");

-- CreateIndex
CREATE INDEX "CabinetMeeting_countryId_idx" ON "CabinetMeeting"("countryId");

-- CreateIndex
CREATE INDEX "CabinetMeeting_userId_idx" ON "CabinetMeeting"("userId");

-- CreateIndex
CREATE INDEX "CabinetMeeting_scheduledDate_idx" ON "CabinetMeeting"("scheduledDate");

-- CreateIndex
CREATE INDEX "CabinetMeeting_scheduledIxTime_idx" ON "CabinetMeeting"("scheduledIxTime");

-- CreateIndex
CREATE INDEX "CabinetMeeting_status_idx" ON "CabinetMeeting"("status");

-- CreateIndex
CREATE INDEX "MeetingAttendance_meetingId_idx" ON "MeetingAttendance"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAttendance_officialId_idx" ON "MeetingAttendance"("officialId");

-- CreateIndex
CREATE INDEX "MeetingAttendance_attendanceStatus_idx" ON "MeetingAttendance"("attendanceStatus");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_meetingId_idx" ON "MeetingAgendaItem"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_category_idx" ON "MeetingAgendaItem"("category");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_status_idx" ON "MeetingAgendaItem"("status");

-- CreateIndex
CREATE INDEX "MeetingDecision_meetingId_idx" ON "MeetingDecision"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingDecision_agendaItemId_idx" ON "MeetingDecision"("agendaItemId");

-- CreateIndex
CREATE INDEX "MeetingDecision_decisionType_idx" ON "MeetingDecision"("decisionType");

-- CreateIndex
CREATE INDEX "MeetingDecision_implementationStatus_idx" ON "MeetingDecision"("implementationStatus");

-- CreateIndex
CREATE INDEX "MeetingActionItem_meetingId_idx" ON "MeetingActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingActionItem_agendaItemId_idx" ON "MeetingActionItem"("agendaItemId");

-- CreateIndex
CREATE INDEX "MeetingActionItem_decisionId_idx" ON "MeetingActionItem"("decisionId");

-- CreateIndex
CREATE INDEX "MeetingActionItem_status_idx" ON "MeetingActionItem"("status");

-- CreateIndex
CREATE INDEX "MeetingActionItem_priority_idx" ON "MeetingActionItem"("priority");

-- CreateIndex
CREATE INDEX "MeetingActionItem_dueDate_idx" ON "MeetingActionItem"("dueDate");

-- CreateIndex
CREATE INDEX "Policy_countryId_idx" ON "Policy"("countryId");

-- CreateIndex
CREATE INDEX "Policy_userId_idx" ON "Policy"("userId");

-- CreateIndex
CREATE INDEX "Policy_policyType_idx" ON "Policy"("policyType");

-- CreateIndex
CREATE INDEX "Policy_status_idx" ON "Policy"("status");

-- CreateIndex
CREATE INDEX "Policy_effectiveDate_idx" ON "Policy"("effectiveDate");

-- CreateIndex
CREATE INDEX "Policy_effectiveIxTime_idx" ON "Policy"("effectiveIxTime");

-- CreateIndex
CREATE INDEX "PolicyEffectLog_policyId_idx" ON "PolicyEffectLog"("policyId");

-- CreateIndex
CREATE INDEX "PolicyEffectLog_appliedIxTime_idx" ON "PolicyEffectLog"("appliedIxTime");

-- CreateIndex
CREATE INDEX "PolicyEffectLog_effectType_idx" ON "PolicyEffectLog"("effectType");

-- CreateIndex
CREATE INDEX "ActivitySchedule_countryId_idx" ON "ActivitySchedule"("countryId");

-- CreateIndex
CREATE INDEX "ActivitySchedule_userId_idx" ON "ActivitySchedule"("userId");

-- CreateIndex
CREATE INDEX "ActivitySchedule_scheduledDate_idx" ON "ActivitySchedule"("scheduledDate");

-- CreateIndex
CREATE INDEX "ActivitySchedule_scheduledIxTime_idx" ON "ActivitySchedule"("scheduledIxTime");

-- CreateIndex
CREATE INDEX "ActivitySchedule_activityType_idx" ON "ActivitySchedule"("activityType");

-- CreateIndex
CREATE INDEX "ActivitySchedule_status_idx" ON "ActivitySchedule"("status");

-- CreateIndex
CREATE INDEX "ActivitySchedule_priority_idx" ON "ActivitySchedule"("priority");

-- CreateIndex
CREATE INDEX "QuickActionTemplate_actionType_idx" ON "QuickActionTemplate"("actionType");

-- CreateIndex
CREATE INDEX "QuickActionTemplate_category_idx" ON "QuickActionTemplate"("category");

-- CreateIndex
CREATE INDEX "QuickActionTemplate_isActive_idx" ON "QuickActionTemplate"("isActive");
