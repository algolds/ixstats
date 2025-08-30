-- CreateTable
CREATE TABLE "TaxSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "taxSystemName" TEXT NOT NULL,
    "taxAuthority" TEXT,
    "fiscalYear" TEXT NOT NULL DEFAULT 'calendar',
    "taxCode" TEXT,
    "baseRate" REAL,
    "progressiveTax" BOOLEAN NOT NULL DEFAULT true,
    "flatTaxRate" REAL,
    "alternativeMinTax" BOOLEAN NOT NULL DEFAULT false,
    "alternativeMinRate" REAL,
    "taxHolidays" TEXT,
    "complianceRate" REAL,
    "collectionEfficiency" REAL,
    "lastReform" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxSystem_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "categoryType" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseRate" REAL,
    "calculationMethod" TEXT NOT NULL DEFAULT 'percentage',
    "minimumAmount" REAL,
    "maximumAmount" REAL,
    "exemptionAmount" REAL,
    "deductionAllowed" BOOLEAN NOT NULL DEFAULT true,
    "standardDeduction" REAL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "color" TEXT,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxCategory_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "TaxSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "bracketName" TEXT,
    "minIncome" REAL NOT NULL,
    "maxIncome" REAL,
    "rate" REAL NOT NULL,
    "flatAmount" REAL,
    "marginalRate" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxBracket_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "TaxSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxBracket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxExemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "categoryId" TEXT,
    "exemptionName" TEXT NOT NULL,
    "exemptionType" TEXT NOT NULL,
    "description" TEXT,
    "exemptionAmount" REAL,
    "exemptionRate" REAL,
    "qualifications" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxExemption_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "TaxSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxExemption_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxDeduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "deductionName" TEXT NOT NULL,
    "deductionType" TEXT NOT NULL,
    "description" TEXT,
    "maximumAmount" REAL,
    "percentage" REAL,
    "qualifications" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxDeduction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "description" TEXT,
    "targetCategory" TEXT,
    "impactType" TEXT NOT NULL,
    "rateChange" REAL,
    "effectiveDate" DATETIME NOT NULL,
    "expiryDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "estimatedRevenue" REAL,
    "affectedPopulation" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxPolicy_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "TaxSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxSystemId" TEXT NOT NULL,
    "calculationName" TEXT NOT NULL,
    "taxableIncome" REAL NOT NULL,
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "totalExemptions" REAL NOT NULL DEFAULT 0,
    "adjustedGrossIncome" REAL NOT NULL,
    "taxOwed" REAL NOT NULL,
    "effectiveRate" REAL NOT NULL,
    "marginalRate" REAL NOT NULL,
    "breakdown" TEXT,
    "calculationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxCalculation_taxSystemId_fkey" FOREIGN KEY ("taxSystemId") REFERENCES "TaxSystem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinktankGroup" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThinktankGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinktankMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT,
    CONSTRAINT "ThinktankMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinktankMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinktankMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
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
    CONSTRAINT "ThinktankMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinktankMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ThinktankMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinktankInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "invitedUser" TEXT,
    "inviteCode" TEXT,
    "expiresAt" DATETIME,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThinktankInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinktankInvite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollaborativeDoc" (
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
    CONSTRAINT "CollaborativeDoc_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ThinktankGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollaborativeDoc_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollaborativeDoc_lastEditBy_fkey" FOREIGN KEY ("lastEditBy") REFERENCES "ThinkpagesAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinkshareConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationSettings" TEXT,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ThinkshareConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinkshareMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
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
    CONSTRAINT "ThinkshareMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinkshareMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ThinkshareMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageReadReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageType" TEXT NOT NULL,
    CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ThinktankMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ThinkshareMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReadReceipt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountPresence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'available',
    "customStatus" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountPresence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArchetypeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "maxSelectable" INTEGER NOT NULL DEFAULT 2,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Archetype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "gradient" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isSelectable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT,
    "filterRules" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Archetype_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ArchetypeCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserArchetypeSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "archetypeId" TEXT NOT NULL,
    "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserArchetypeSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserArchetypeSelection_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CountryArchetypeMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "archetypeId" TEXT NOT NULL,
    "matchScore" REAL NOT NULL DEFAULT 1.0,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CountryArchetypeMatch_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CountryArchetypeMatch_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NationalIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "countryName" TEXT,
    "officialName" TEXT,
    "governmentType" TEXT,
    "motto" TEXT,
    "mottoNative" TEXT,
    "capitalCity" TEXT,
    "largestCity" TEXT,
    "demonym" TEXT,
    "currency" TEXT,
    "currencySymbol" TEXT,
    "officialLanguages" TEXT,
    "nationalLanguage" TEXT,
    "nationalAnthem" TEXT,
    "nationalDay" TEXT,
    "callingCode" TEXT,
    "internetTLD" TEXT,
    "drivingSide" TEXT,
    "timeZone" TEXT,
    "isoCode" TEXT,
    "coordinatesLatitude" TEXT,
    "coordinatesLongitude" TEXT,
    "emergencyNumber" TEXT,
    "postalCodeFormat" TEXT,
    "nationalSport" TEXT,
    "weekStartDay" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NationalIdentity_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostBookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PostFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActivityFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'game',
    "userId" TEXT,
    "countryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "relatedCountries" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLike_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityComment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityShare_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiplomaticEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country1Id" TEXT NOT NULL,
    "country2Id" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tradeValue" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "embassyId" TEXT,
    "missionId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "relationshipImpact" REAL NOT NULL DEFAULT 0,
    "reputationImpact" REAL NOT NULL DEFAULT 0,
    "economicImpact" REAL NOT NULL DEFAULT 0,
    "ixTimeTimestamp" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetCountryId" TEXT,
    "connectionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "iconUrl" TEXT,
    "metadata" TEXT,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CountryActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DiplomaticAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCountryId" TEXT NOT NULL,
    "toCountryId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Embassy" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiplomaticChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'PUBLIC',
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiplomaticChannelParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "flagUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiplomaticChannelParticipant_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "DiplomaticChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiplomaticMessage" (
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
    CONSTRAINT "DiplomaticMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "DiplomaticChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CulturalExchange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CulturalExchangeParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "flagUrl" TEXT,
    "role" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CulturalExchangeParticipant_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "CulturalExchange" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CulturalArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "fileUrl" TEXT,
    "contributor" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CulturalArtifact_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "CulturalExchange" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmbassyMission" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmbassyMission_embassyId_fkey" FOREIGN KEY ("embassyId") REFERENCES "Embassy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmbassyUpgrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "embassyId" TEXT NOT NULL,
    "upgradeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "cost" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'available',
    "startedAt" DATETIME,
    "completesAt" DATETIME,
    "progress" REAL NOT NULL DEFAULT 0,
    "effects" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmbassyUpgrade_embassyId_fkey" FOREIGN KEY ("embassyId") REFERENCES "Embassy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmbassyRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostCountryId" TEXT NOT NULL,
    "requiredRelationship" TEXT NOT NULL DEFAULT 'neutral',
    "minRelationStrength" INTEGER NOT NULL DEFAULT 25,
    "establishmentCost" REAL NOT NULL DEFAULT 100000,
    "approvalTime" INTEGER NOT NULL DEFAULT 30,
    "specialRequirements" TEXT,
    "economicTierMultiplier" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "roleId" TEXT,
    "permissions" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GovernmentStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "governmentName" TEXT NOT NULL,
    "governmentType" TEXT NOT NULL,
    "headOfState" TEXT,
    "headOfGovernment" TEXT,
    "legislatureName" TEXT,
    "executiveName" TEXT,
    "judicialName" TEXT,
    "totalBudget" REAL NOT NULL DEFAULT 0,
    "fiscalYear" TEXT NOT NULL DEFAULT 'Calendar Year',
    "budgetCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GovernmentStructure_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernmentDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "governmentStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "minister" TEXT,
    "ministerTitle" TEXT NOT NULL DEFAULT 'Minister',
    "headquarters" TEXT,
    "established" TEXT,
    "employeeCount" INTEGER,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentDepartmentId" TEXT,
    "organizationalLevel" TEXT NOT NULL DEFAULT 'Ministry',
    "functions" TEXT,
    "kpis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GovernmentDepartment_governmentStructureId_fkey" FOREIGN KEY ("governmentStructureId") REFERENCES "GovernmentStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GovernmentDepartment_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "GovernmentDepartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "governmentStructureId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "budgetYear" INTEGER NOT NULL,
    "allocatedAmount" REAL NOT NULL,
    "allocatedPercent" REAL NOT NULL,
    "spentAmount" REAL NOT NULL DEFAULT 0,
    "encumberedAmount" REAL NOT NULL DEFAULT 0,
    "availableAmount" REAL NOT NULL DEFAULT 0,
    "budgetStatus" TEXT NOT NULL DEFAULT 'Allocated',
    "lastReviewed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetAllocation_governmentStructureId_fkey" FOREIGN KEY ("governmentStructureId") REFERENCES "GovernmentStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "GovernmentDepartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubBudgetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" REAL NOT NULL,
    "percent" REAL NOT NULL,
    "budgetType" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubBudgetCategory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "GovernmentDepartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RevenueSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "governmentStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "rate" REAL,
    "revenueAmount" REAL NOT NULL DEFAULT 0,
    "revenuePercent" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "collectionMethod" TEXT,
    "administeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RevenueSource_governmentStructureId_fkey" FOREIGN KEY ("governmentStructureId") REFERENCES "GovernmentStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "category" TEXT NOT NULL DEFAULT 'GOVERNANCE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CrisisEvent" ("affectedCountries", "casualties", "createdAt", "description", "economicImpact", "id", "location", "responseStatus", "severity", "timestamp", "title", "type", "updatedAt") SELECT "affectedCountries", "casualties", "createdAt", "description", "economicImpact", "id", "location", "responseStatus", "severity", "timestamp", "title", "type", "updatedAt" FROM "CrisisEvent";
DROP TABLE "CrisisEvent";
ALTER TABLE "new_CrisisEvent" RENAME TO "CrisisEvent";
CREATE TABLE "new_DiplomaticRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country1" TEXT NOT NULL,
    "country2" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "strength" INTEGER NOT NULL,
    "treaties" TEXT,
    "lastContact" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "diplomaticChannels" TEXT,
    "recentActivity" TEXT,
    "tradeVolume" REAL,
    "culturalExchange" TEXT,
    "economicTier" TEXT,
    "flagUrl" TEXT,
    "establishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DiplomaticRelation" ("country1", "country2", "createdAt", "diplomaticChannels", "id", "lastContact", "relationship", "status", "strength", "treaties", "updatedAt") SELECT "country1", "country2", "createdAt", "diplomaticChannels", "id", "lastContact", "relationship", "status", "strength", "treaties", "updatedAt" FROM "DiplomaticRelation";
DROP TABLE "DiplomaticRelation";
ALTER TABLE "new_DiplomaticRelation" RENAME TO "DiplomaticRelation";
CREATE INDEX "DiplomaticRelation_country1_idx" ON "DiplomaticRelation"("country1");
CREATE INDEX "DiplomaticRelation_country2_idx" ON "DiplomaticRelation"("country2");
CREATE INDEX "DiplomaticRelation_relationship_idx" ON "DiplomaticRelation"("relationship");
CREATE INDEX "DiplomaticRelation_status_idx" ON "DiplomaticRelation"("status");
CREATE UNIQUE INDEX "DiplomaticRelation_country1_country2_key" ON "DiplomaticRelation"("country1", "country2");
CREATE TABLE "new_IntelligenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "region" TEXT,
    "affectedCountries" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER,
    "itemType" TEXT NOT NULL DEFAULT 'update',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_IntelligenceItem" ("affectedCountries", "category", "content", "createdAt", "id", "isActive", "priority", "region", "source", "timestamp", "title", "updatedAt") SELECT "affectedCountries", "category", "content", "createdAt", "id", "isActive", "priority", "region", "source", "timestamp", "title", "updatedAt" FROM "IntelligenceItem";
DROP TABLE "IntelligenceItem";
ALTER TABLE "new_IntelligenceItem" RENAME TO "IntelligenceItem";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "countryId" TEXT,
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("clerkUserId", "countryId", "createdAt", "id", "updatedAt") SELECT "clerkUserId", "countryId", "createdAt", "id", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
CREATE UNIQUE INDEX "User_countryId_key" ON "User"("countryId");
CREATE INDEX "User_clerkUserId_idx" ON "User"("clerkUserId");
CREATE INDEX "User_countryId_idx" ON "User"("countryId");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TaxSystem_countryId_key" ON "TaxSystem"("countryId");

-- CreateIndex
CREATE INDEX "TaxSystem_countryId_idx" ON "TaxSystem"("countryId");

-- CreateIndex
CREATE INDEX "TaxCategory_taxSystemId_idx" ON "TaxCategory"("taxSystemId");

-- CreateIndex
CREATE INDEX "TaxCategory_categoryName_idx" ON "TaxCategory"("categoryName");

-- CreateIndex
CREATE INDEX "TaxBracket_taxSystemId_idx" ON "TaxBracket"("taxSystemId");

-- CreateIndex
CREATE INDEX "TaxBracket_categoryId_idx" ON "TaxBracket"("categoryId");

-- CreateIndex
CREATE INDEX "TaxBracket_minIncome_maxIncome_idx" ON "TaxBracket"("minIncome", "maxIncome");

-- CreateIndex
CREATE INDEX "TaxExemption_taxSystemId_idx" ON "TaxExemption"("taxSystemId");

-- CreateIndex
CREATE INDEX "TaxExemption_categoryId_idx" ON "TaxExemption"("categoryId");

-- CreateIndex
CREATE INDEX "TaxExemption_exemptionType_idx" ON "TaxExemption"("exemptionType");

-- CreateIndex
CREATE INDEX "TaxDeduction_categoryId_idx" ON "TaxDeduction"("categoryId");

-- CreateIndex
CREATE INDEX "TaxDeduction_deductionType_idx" ON "TaxDeduction"("deductionType");

-- CreateIndex
CREATE INDEX "TaxPolicy_taxSystemId_idx" ON "TaxPolicy"("taxSystemId");

-- CreateIndex
CREATE INDEX "TaxPolicy_effectiveDate_idx" ON "TaxPolicy"("effectiveDate");

-- CreateIndex
CREATE INDEX "TaxPolicy_isActive_idx" ON "TaxPolicy"("isActive");

-- CreateIndex
CREATE INDEX "TaxCalculation_taxSystemId_idx" ON "TaxCalculation"("taxSystemId");

-- CreateIndex
CREATE INDEX "TaxCalculation_taxYear_idx" ON "TaxCalculation"("taxYear");

-- CreateIndex
CREATE INDEX "TaxCalculation_calculationDate_idx" ON "TaxCalculation"("calculationDate");

-- CreateIndex
CREATE INDEX "ThinktankGroup_type_idx" ON "ThinktankGroup"("type");

-- CreateIndex
CREATE INDEX "ThinktankGroup_category_idx" ON "ThinktankGroup"("category");

-- CreateIndex
CREATE INDEX "ThinktankGroup_createdBy_idx" ON "ThinktankGroup"("createdBy");

-- CreateIndex
CREATE INDEX "ThinktankGroup_isActive_idx" ON "ThinktankGroup"("isActive");

-- CreateIndex
CREATE INDEX "ThinktankMember_groupId_idx" ON "ThinktankMember"("groupId");

-- CreateIndex
CREATE INDEX "ThinktankMember_accountId_idx" ON "ThinktankMember"("accountId");

-- CreateIndex
CREATE INDEX "ThinktankMember_role_idx" ON "ThinktankMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ThinktankMember_groupId_accountId_key" ON "ThinktankMember"("groupId", "accountId");

-- CreateIndex
CREATE INDEX "ThinktankMessage_groupId_idx" ON "ThinktankMessage"("groupId");

-- CreateIndex
CREATE INDEX "ThinktankMessage_accountId_idx" ON "ThinktankMessage"("accountId");

-- CreateIndex
CREATE INDEX "ThinktankMessage_ixTimeTimestamp_idx" ON "ThinktankMessage"("ixTimeTimestamp");

-- CreateIndex
CREATE INDEX "ThinktankMessage_messageType_idx" ON "ThinktankMessage"("messageType");

-- CreateIndex
CREATE INDEX "ThinktankInvite_groupId_idx" ON "ThinktankInvite"("groupId");

-- CreateIndex
CREATE INDEX "ThinktankInvite_invitedBy_idx" ON "ThinktankInvite"("invitedBy");

-- CreateIndex
CREATE INDEX "ThinktankInvite_inviteCode_idx" ON "ThinktankInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "CollaborativeDoc_groupId_idx" ON "CollaborativeDoc"("groupId");

-- CreateIndex
CREATE INDEX "CollaborativeDoc_createdBy_idx" ON "CollaborativeDoc"("createdBy");

-- CreateIndex
CREATE INDEX "CollaborativeDoc_isPublic_idx" ON "CollaborativeDoc"("isPublic");

-- CreateIndex
CREATE INDEX "ThinkshareConversation_type_idx" ON "ThinkshareConversation"("type");

-- CreateIndex
CREATE INDEX "ThinkshareConversation_lastActivity_idx" ON "ThinkshareConversation"("lastActivity");

-- CreateIndex
CREATE INDEX "ThinkshareConversation_isActive_idx" ON "ThinkshareConversation"("isActive");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_accountId_idx" ON "ConversationParticipant"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_accountId_key" ON "ConversationParticipant"("conversationId", "accountId");

-- CreateIndex
CREATE INDEX "ThinkshareMessage_conversationId_idx" ON "ThinkshareMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ThinkshareMessage_accountId_idx" ON "ThinkshareMessage"("accountId");

-- CreateIndex
CREATE INDEX "ThinkshareMessage_ixTimeTimestamp_idx" ON "ThinkshareMessage"("ixTimeTimestamp");

-- CreateIndex
CREATE INDEX "ThinkshareMessage_messageType_idx" ON "ThinkshareMessage"("messageType");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_messageId_idx" ON "MessageReadReceipt"("messageId");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_accountId_idx" ON "MessageReadReceipt"("accountId");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_messageType_idx" ON "MessageReadReceipt"("messageType");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReadReceipt_messageId_accountId_key" ON "MessageReadReceipt"("messageId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountPresence_accountId_key" ON "AccountPresence"("accountId");

-- CreateIndex
CREATE INDEX "AccountPresence_isOnline_idx" ON "AccountPresence"("isOnline");

-- CreateIndex
CREATE INDEX "AccountPresence_lastSeen_idx" ON "AccountPresence"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "ArchetypeCategory_name_key" ON "ArchetypeCategory"("name");

-- CreateIndex
CREATE INDEX "ArchetypeCategory_priority_idx" ON "ArchetypeCategory"("priority");

-- CreateIndex
CREATE INDEX "ArchetypeCategory_isActive_idx" ON "ArchetypeCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Archetype_name_key" ON "Archetype"("name");

-- CreateIndex
CREATE INDEX "Archetype_categoryId_idx" ON "Archetype"("categoryId");

-- CreateIndex
CREATE INDEX "Archetype_priority_idx" ON "Archetype"("priority");

-- CreateIndex
CREATE INDEX "Archetype_isSelectable_idx" ON "Archetype"("isSelectable");

-- CreateIndex
CREATE INDEX "Archetype_isActive_idx" ON "Archetype"("isActive");

-- CreateIndex
CREATE INDEX "UserArchetypeSelection_userId_idx" ON "UserArchetypeSelection"("userId");

-- CreateIndex
CREATE INDEX "UserArchetypeSelection_archetypeId_idx" ON "UserArchetypeSelection"("archetypeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserArchetypeSelection_userId_archetypeId_key" ON "UserArchetypeSelection"("userId", "archetypeId");

-- CreateIndex
CREATE INDEX "CountryArchetypeMatch_countryId_idx" ON "CountryArchetypeMatch"("countryId");

-- CreateIndex
CREATE INDEX "CountryArchetypeMatch_archetypeId_idx" ON "CountryArchetypeMatch"("archetypeId");

-- CreateIndex
CREATE INDEX "CountryArchetypeMatch_matchScore_idx" ON "CountryArchetypeMatch"("matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "CountryArchetypeMatch_countryId_archetypeId_key" ON "CountryArchetypeMatch"("countryId", "archetypeId");

-- CreateIndex
CREATE UNIQUE INDEX "NationalIdentity_countryId_key" ON "NationalIdentity"("countryId");

-- CreateIndex
CREATE INDEX "NationalIdentity_countryId_idx" ON "NationalIdentity"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "PostBookmark_userId_postId_key" ON "PostBookmark"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostFlag_userId_postId_key" ON "PostFlag"("userId", "postId");

-- CreateIndex
CREATE INDEX "ActivityFeed_type_idx" ON "ActivityFeed"("type");

-- CreateIndex
CREATE INDEX "ActivityFeed_category_idx" ON "ActivityFeed"("category");

-- CreateIndex
CREATE INDEX "ActivityFeed_userId_idx" ON "ActivityFeed"("userId");

-- CreateIndex
CREATE INDEX "ActivityFeed_countryId_idx" ON "ActivityFeed"("countryId");

-- CreateIndex
CREATE INDEX "ActivityFeed_priority_idx" ON "ActivityFeed"("priority");

-- CreateIndex
CREATE INDEX "ActivityFeed_createdAt_idx" ON "ActivityFeed"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityFeed_visibility_idx" ON "ActivityFeed"("visibility");

-- CreateIndex
CREATE INDEX "ActivityLike_activityId_idx" ON "ActivityLike"("activityId");

-- CreateIndex
CREATE INDEX "ActivityLike_userId_idx" ON "ActivityLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLike_activityId_userId_key" ON "ActivityLike"("activityId", "userId");

-- CreateIndex
CREATE INDEX "ActivityComment_activityId_idx" ON "ActivityComment"("activityId");

-- CreateIndex
CREATE INDEX "ActivityComment_userId_idx" ON "ActivityComment"("userId");

-- CreateIndex
CREATE INDEX "ActivityComment_createdAt_idx" ON "ActivityComment"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityShare_activityId_idx" ON "ActivityShare"("activityId");

-- CreateIndex
CREATE INDEX "ActivityShare_userId_idx" ON "ActivityShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityShare_activityId_userId_key" ON "ActivityShare"("activityId", "userId");

-- CreateIndex
CREATE INDEX "DiplomaticEvent_country1Id_idx" ON "DiplomaticEvent"("country1Id");

-- CreateIndex
CREATE INDEX "DiplomaticEvent_country2Id_idx" ON "DiplomaticEvent"("country2Id");

-- CreateIndex
CREATE INDEX "DiplomaticEvent_eventType_idx" ON "DiplomaticEvent"("eventType");

-- CreateIndex
CREATE INDEX "DiplomaticEvent_embassyId_idx" ON "DiplomaticEvent"("embassyId");

-- CreateIndex
CREATE INDEX "DiplomaticEvent_createdAt_idx" ON "DiplomaticEvent"("createdAt");

-- CreateIndex
CREATE INDEX "UserConnection_userId_idx" ON "UserConnection"("userId");

-- CreateIndex
CREATE INDEX "UserConnection_targetUserId_idx" ON "UserConnection"("targetUserId");

-- CreateIndex
CREATE INDEX "UserConnection_targetCountryId_idx" ON "UserConnection"("targetCountryId");

-- CreateIndex
CREATE INDEX "UserConnection_connectionType_idx" ON "UserConnection"("connectionType");

-- CreateIndex
CREATE UNIQUE INDEX "UserConnection_userId_targetUserId_connectionType_key" ON "UserConnection"("userId", "targetUserId", "connectionType");

-- CreateIndex
CREATE UNIQUE INDEX "UserConnection_userId_targetCountryId_connectionType_key" ON "UserConnection"("userId", "targetCountryId", "connectionType");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_category_idx" ON "UserAchievement"("category");

-- CreateIndex
CREATE INDEX "UserAchievement_rarity_idx" ON "UserAchievement"("rarity");

-- CreateIndex
CREATE INDEX "UserAchievement_unlockedAt_idx" ON "UserAchievement"("unlockedAt");

-- CreateIndex
CREATE INDEX "CountryActivity_countryId_idx" ON "CountryActivity"("countryId");

-- CreateIndex
CREATE INDEX "CountryActivity_type_idx" ON "CountryActivity"("type");

-- CreateIndex
CREATE INDEX "CountryActivity_timestamp_idx" ON "CountryActivity"("timestamp");

-- CreateIndex
CREATE INDEX "DiplomaticAction_fromCountryId_idx" ON "DiplomaticAction"("fromCountryId");

-- CreateIndex
CREATE INDEX "DiplomaticAction_toCountryId_idx" ON "DiplomaticAction"("toCountryId");

-- CreateIndex
CREATE INDEX "Embassy_hostCountryId_idx" ON "Embassy"("hostCountryId");

-- CreateIndex
CREATE INDEX "Embassy_guestCountryId_idx" ON "Embassy"("guestCountryId");

-- CreateIndex
CREATE INDEX "Embassy_status_idx" ON "Embassy"("status");

-- CreateIndex
CREATE INDEX "Embassy_level_idx" ON "Embassy"("level");

-- CreateIndex
CREATE INDEX "Embassy_specialization_idx" ON "Embassy"("specialization");

-- CreateIndex
CREATE UNIQUE INDEX "Embassy_hostCountryId_guestCountryId_key" ON "Embassy"("hostCountryId", "guestCountryId");

-- CreateIndex
CREATE INDEX "DiplomaticChannel_type_idx" ON "DiplomaticChannel"("type");

-- CreateIndex
CREATE INDEX "DiplomaticChannel_classification_idx" ON "DiplomaticChannel"("classification");

-- CreateIndex
CREATE INDEX "DiplomaticChannel_lastActivity_idx" ON "DiplomaticChannel"("lastActivity");

-- CreateIndex
CREATE INDEX "DiplomaticChannelParticipant_channelId_idx" ON "DiplomaticChannelParticipant"("channelId");

-- CreateIndex
CREATE INDEX "DiplomaticChannelParticipant_countryId_idx" ON "DiplomaticChannelParticipant"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "DiplomaticChannelParticipant_channelId_countryId_key" ON "DiplomaticChannelParticipant"("channelId", "countryId");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_channelId_idx" ON "DiplomaticMessage"("channelId");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_fromCountryId_idx" ON "DiplomaticMessage"("fromCountryId");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_toCountryId_idx" ON "DiplomaticMessage"("toCountryId");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_classification_idx" ON "DiplomaticMessage"("classification");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_priority_idx" ON "DiplomaticMessage"("priority");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_status_idx" ON "DiplomaticMessage"("status");

-- CreateIndex
CREATE INDEX "DiplomaticMessage_ixTimeTimestamp_idx" ON "DiplomaticMessage"("ixTimeTimestamp");

-- CreateIndex
CREATE INDEX "CulturalExchange_hostCountryId_idx" ON "CulturalExchange"("hostCountryId");

-- CreateIndex
CREATE INDEX "CulturalExchange_type_idx" ON "CulturalExchange"("type");

-- CreateIndex
CREATE INDEX "CulturalExchange_status_idx" ON "CulturalExchange"("status");

-- CreateIndex
CREATE INDEX "CulturalExchange_startDate_idx" ON "CulturalExchange"("startDate");

-- CreateIndex
CREATE INDEX "CulturalExchangeParticipant_exchangeId_idx" ON "CulturalExchangeParticipant"("exchangeId");

-- CreateIndex
CREATE INDEX "CulturalExchangeParticipant_countryId_idx" ON "CulturalExchangeParticipant"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExchangeParticipant_exchangeId_countryId_key" ON "CulturalExchangeParticipant"("exchangeId", "countryId");

-- CreateIndex
CREATE INDEX "CulturalArtifact_exchangeId_idx" ON "CulturalArtifact"("exchangeId");

-- CreateIndex
CREATE INDEX "CulturalArtifact_countryId_idx" ON "CulturalArtifact"("countryId");

-- CreateIndex
CREATE INDEX "CulturalArtifact_type_idx" ON "CulturalArtifact"("type");

-- CreateIndex
CREATE INDEX "EmbassyMission_embassyId_idx" ON "EmbassyMission"("embassyId");

-- CreateIndex
CREATE INDEX "EmbassyMission_type_idx" ON "EmbassyMission"("type");

-- CreateIndex
CREATE INDEX "EmbassyMission_status_idx" ON "EmbassyMission"("status");

-- CreateIndex
CREATE INDEX "EmbassyMission_completesAt_idx" ON "EmbassyMission"("completesAt");

-- CreateIndex
CREATE INDEX "EmbassyUpgrade_embassyId_idx" ON "EmbassyUpgrade"("embassyId");

-- CreateIndex
CREATE INDEX "EmbassyUpgrade_upgradeType_idx" ON "EmbassyUpgrade"("upgradeType");

-- CreateIndex
CREATE INDEX "EmbassyUpgrade_status_idx" ON "EmbassyUpgrade"("status");

-- CreateIndex
CREATE INDEX "EmbassyRequirement_hostCountryId_idx" ON "EmbassyRequirement"("hostCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbassyRequirement_hostCountryId_key" ON "EmbassyRequirement"("hostCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_level_key" ON "Role"("level");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_level_idx" ON "Role"("level");

-- CreateIndex
CREATE INDEX "Role_isActive_idx" ON "Role"("isActive");

-- CreateIndex
CREATE INDEX "Role_isSystem_idx" ON "Role"("isSystem");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_name_idx" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_category_idx" ON "Permission"("category");

-- CreateIndex
CREATE INDEX "Permission_isSystem_idx" ON "Permission"("isSystem");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "UserSession_clerkUserId_idx" ON "UserSession"("clerkUserId");

-- CreateIndex
CREATE INDEX "UserSession_roleId_idx" ON "UserSession"("roleId");

-- CreateIndex
CREATE INDEX "UserSession_lastActivity_idx" ON "UserSession"("lastActivity");

-- CreateIndex
CREATE INDEX "UserSession_isActive_idx" ON "UserSession"("isActive");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentStructure_countryId_key" ON "GovernmentStructure"("countryId");

-- CreateIndex
CREATE INDEX "GovernmentStructure_countryId_idx" ON "GovernmentStructure"("countryId");

-- CreateIndex
CREATE INDEX "GovernmentDepartment_governmentStructureId_idx" ON "GovernmentDepartment"("governmentStructureId");

-- CreateIndex
CREATE INDEX "GovernmentDepartment_category_idx" ON "GovernmentDepartment"("category");

-- CreateIndex
CREATE INDEX "GovernmentDepartment_parentDepartmentId_idx" ON "GovernmentDepartment"("parentDepartmentId");

-- CreateIndex
CREATE INDEX "GovernmentDepartment_isActive_idx" ON "GovernmentDepartment"("isActive");

-- CreateIndex
CREATE INDEX "BudgetAllocation_governmentStructureId_idx" ON "BudgetAllocation"("governmentStructureId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_departmentId_idx" ON "BudgetAllocation"("departmentId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_budgetYear_idx" ON "BudgetAllocation"("budgetYear");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAllocation_departmentId_budgetYear_key" ON "BudgetAllocation"("departmentId", "budgetYear");

-- CreateIndex
CREATE INDEX "SubBudgetCategory_departmentId_idx" ON "SubBudgetCategory"("departmentId");

-- CreateIndex
CREATE INDEX "SubBudgetCategory_budgetType_idx" ON "SubBudgetCategory"("budgetType");

-- CreateIndex
CREATE INDEX "RevenueSource_governmentStructureId_idx" ON "RevenueSource"("governmentStructureId");

-- CreateIndex
CREATE INDEX "RevenueSource_category_idx" ON "RevenueSource"("category");

-- CreateIndex
CREATE INDEX "RevenueSource_isActive_idx" ON "RevenueSource"("isActive");
