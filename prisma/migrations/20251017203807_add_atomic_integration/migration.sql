-- AlterTable
ALTER TABLE "Demographics" ADD COLUMN "culturalDiversity" REAL DEFAULT 50;
ALTER TABLE "Demographics" ADD COLUMN "diversityLastUpdated" DATETIME;
ALTER TABLE "Demographics" ADD COLUMN "diversitySource" TEXT;
ALTER TABLE "Demographics" ADD COLUMN "ethnicDiversity" REAL DEFAULT 50;
ALTER TABLE "Demographics" ADD COLUMN "linguisticDiversity" REAL DEFAULT 30;
ALTER TABLE "Demographics" ADD COLUMN "religiousDiversity" REAL DEFAULT 50;

-- AlterTable
ALTER TABLE "GovernmentStructure" ADD COLUMN "corruptionIndex" REAL DEFAULT 50;
ALTER TABLE "GovernmentStructure" ADD COLUMN "democracyIndex" REAL DEFAULT 50;
ALTER TABLE "GovernmentStructure" ADD COLUMN "electionCycle" INTEGER DEFAULT 4;
ALTER TABLE "GovernmentStructure" ADD COLUMN "governmentEffectiveness" REAL DEFAULT 50;
ALTER TABLE "GovernmentStructure" ADD COLUMN "politicalMetricsUpdated" DATETIME;
ALTER TABLE "GovernmentStructure" ADD COLUMN "politicalPolarization" REAL DEFAULT 50;
ALTER TABLE "GovernmentStructure" ADD COLUMN "politicalStability" REAL DEFAULT 0.5;
ALTER TABLE "GovernmentStructure" ADD COLUMN "ruleOfLaw" REAL DEFAULT 50;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "calculatedEffects" TEXT;
ALTER TABLE "Policy" ADD COLUMN "lastRecalculated" DATETIME;
ALTER TABLE "Policy" ADD COLUMN "relatedEconomicComponents" TEXT;
ALTER TABLE "Policy" ADD COLUMN "relatedGovernmentComponents" TEXT;
ALTER TABLE "Policy" ADD COLUMN "relatedTaxComponents" TEXT;

-- CreateTable
CREATE TABLE "EconomicComponent" (
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
    CONSTRAINT "EconomicComponent_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxComponent" (
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
    CONSTRAINT "TaxComponent_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "triggeredBy" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    CONSTRAINT "ComponentChangeLog_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrossBuilderSynergy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "governmentComponents" TEXT NOT NULL,
    "economicComponents" TEXT NOT NULL,
    "taxComponents" TEXT NOT NULL,
    "synergyType" TEXT NOT NULL,
    "effectivenessBonus" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossBuilderSynergy_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceAlertThreshold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "criticalMin" REAL,
    "criticalMax" REAL,
    "highMin" REAL,
    "highMax" REAL,
    "mediumMin" REAL,
    "mediumMax" REAL,
    "notifyOnCritical" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnHigh" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnMedium" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomGovernmentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "customTypeName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "userId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "signingPublicKey" TEXT NOT NULL,
    "encryptedSigningPrivateKey" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EncryptionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DiplomaticMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "fromCountryId" TEXT NOT NULL,
    "fromCountryName" TEXT NOT NULL,
    "toCountryId" TEXT,
    "toCountryName" TEXT,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'PUBLIC',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "ixTimeTimestamp" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "encryptedContent" TEXT,
    "signature" TEXT,
    "encryptionVersion" TEXT,
    "iv" TEXT,
    "encryptedKey" TEXT,
    "senderKeyId" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DiplomaticMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "DiplomaticChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DiplomaticMessage" ("channelId", "classification", "content", "createdAt", "encrypted", "fromCountryId", "fromCountryName", "id", "ixTimeTimestamp", "priority", "status", "subject", "toCountryId", "toCountryName", "updatedAt") SELECT "channelId", "classification", "content", "createdAt", "encrypted", "fromCountryId", "fromCountryName", "id", "ixTimeTimestamp", "priority", "status", "subject", "toCountryId", "toCountryName", "updatedAt" FROM "DiplomaticMessage";
DROP TABLE "DiplomaticMessage";
ALTER TABLE "new_DiplomaticMessage" RENAME TO "DiplomaticMessage";
CREATE INDEX "DiplomaticMessage_channelId_idx" ON "DiplomaticMessage"("channelId");
CREATE INDEX "DiplomaticMessage_fromCountryId_idx" ON "DiplomaticMessage"("fromCountryId");
CREATE INDEX "DiplomaticMessage_toCountryId_idx" ON "DiplomaticMessage"("toCountryId");
CREATE INDEX "DiplomaticMessage_classification_idx" ON "DiplomaticMessage"("classification");
CREATE INDEX "DiplomaticMessage_priority_idx" ON "DiplomaticMessage"("priority");
CREATE INDEX "DiplomaticMessage_status_idx" ON "DiplomaticMessage"("status");
CREATE INDEX "DiplomaticMessage_ixTimeTimestamp_idx" ON "DiplomaticMessage"("ixTimeTimestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EconomicComponent_countryId_idx" ON "EconomicComponent"("countryId");

-- CreateIndex
CREATE INDEX "EconomicComponent_componentType_idx" ON "EconomicComponent"("componentType");

-- CreateIndex
CREATE INDEX "EconomicComponent_isActive_idx" ON "EconomicComponent"("isActive");

-- CreateIndex
CREATE INDEX "TaxComponent_countryId_idx" ON "TaxComponent"("countryId");

-- CreateIndex
CREATE INDEX "TaxComponent_componentType_idx" ON "TaxComponent"("componentType");

-- CreateIndex
CREATE INDEX "TaxComponent_isActive_idx" ON "TaxComponent"("isActive");

-- CreateIndex
CREATE INDEX "ComponentChangeLog_countryId_idx" ON "ComponentChangeLog"("countryId");

-- CreateIndex
CREATE INDEX "ComponentChangeLog_componentType_idx" ON "ComponentChangeLog"("componentType");

-- CreateIndex
CREATE INDEX "ComponentChangeLog_changeType_idx" ON "ComponentChangeLog"("changeType");

-- CreateIndex
CREATE INDEX "ComponentChangeLog_timestamp_idx" ON "ComponentChangeLog"("timestamp");

-- CreateIndex
CREATE INDEX "CrossBuilderSynergy_countryId_idx" ON "CrossBuilderSynergy"("countryId");

-- CreateIndex
CREATE INDEX "CrossBuilderSynergy_synergyType_idx" ON "CrossBuilderSynergy"("synergyType");

-- CreateIndex
CREATE INDEX "CrossBuilderSynergy_isActive_idx" ON "CrossBuilderSynergy"("isActive");

-- CreateIndex
CREATE INDEX "IntelligenceAlertThreshold_countryId_idx" ON "IntelligenceAlertThreshold"("countryId");

-- CreateIndex
CREATE INDEX "IntelligenceAlertThreshold_userId_idx" ON "IntelligenceAlertThreshold"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceAlertThreshold_countryId_alertType_metricName_key" ON "IntelligenceAlertThreshold"("countryId", "alertType", "metricName");

-- CreateIndex
CREATE INDEX "CustomGovernmentType_userId_idx" ON "CustomGovernmentType"("userId");

-- CreateIndex
CREATE INDEX "CustomGovernmentType_usageCount_idx" ON "CustomGovernmentType"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "CustomGovernmentType_userId_customTypeName_key" ON "CustomGovernmentType"("userId", "customTypeName");

-- CreateIndex
CREATE INDEX "CustomFieldValue_fieldName_isGlobal_idx" ON "CustomFieldValue"("fieldName", "isGlobal");

-- CreateIndex
CREATE INDEX "CustomFieldValue_userId_idx" ON "CustomFieldValue"("userId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_usageCount_idx" ON "CustomFieldValue"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_fieldName_value_userId_key" ON "CustomFieldValue"("fieldName", "value", "userId");

-- CreateIndex
CREATE INDEX "EncryptionKey_countryId_idx" ON "EncryptionKey"("countryId");

-- CreateIndex
CREATE INDEX "EncryptionKey_status_idx" ON "EncryptionKey"("status");

-- CreateIndex
CREATE INDEX "EncryptionKey_expiresAt_idx" ON "EncryptionKey"("expiresAt");

-- CreateIndex
CREATE INDEX "EncryptionAuditLog_countryId_idx" ON "EncryptionAuditLog"("countryId");

-- CreateIndex
CREATE INDEX "EncryptionAuditLog_operation_idx" ON "EncryptionAuditLog"("operation");

-- CreateIndex
CREATE INDEX "EncryptionAuditLog_createdAt_idx" ON "EncryptionAuditLog"("createdAt");
