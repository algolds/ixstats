-- AlterTable
ALTER TABLE "Country" ADD COLUMN "coatOfArms" TEXT;
ALTER TABLE "Country" ADD COLUMN "flag" TEXT;

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "economicAlerts" BOOLEAN NOT NULL DEFAULT true,
    "crisisAlerts" BOOLEAN NOT NULL DEFAULT true,
    "diplomaticAlerts" BOOLEAN NOT NULL DEFAULT false,
    "systemAlerts" BOOLEAN NOT NULL DEFAULT true,
    "notificationLevel" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ThinkpagesAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "personality" TEXT NOT NULL DEFAULT 'serious',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThinkpagesAccount_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThinkpagesPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
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
    CONSTRAINT "ThinkpagesPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThinkpagesPost_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "ThinkpagesPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ThinkpagesPost_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "ThinkpagesPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostReaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "mentionedAccountId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PostMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostMention_mentionedAccountId_fkey" FOREIGN KEY ("mentionedAccountId") REFERENCES "ThinkpagesAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ThinkpagesPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrendingTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hashtag" TEXT NOT NULL,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "region" TEXT,
    "peakTimestamp" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CountryMoodMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "sentimentScore" REAL NOT NULL,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CountryMoodMetric_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserPreferences_userId_idx" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThinkpagesAccount_username_key" ON "ThinkpagesAccount"("username");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_countryId_idx" ON "ThinkpagesAccount"("countryId");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_accountType_idx" ON "ThinkpagesAccount"("accountType");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_username_idx" ON "ThinkpagesAccount"("username");

-- CreateIndex
CREATE INDEX "ThinkpagesAccount_verified_idx" ON "ThinkpagesAccount"("verified");

-- CreateIndex
CREATE INDEX "ThinkpagesPost_accountId_idx" ON "ThinkpagesPost"("accountId");

-- CreateIndex
CREATE INDEX "ThinkpagesPost_ixTimeTimestamp_idx" ON "ThinkpagesPost"("ixTimeTimestamp");

-- CreateIndex
CREATE INDEX "ThinkpagesPost_trending_idx" ON "ThinkpagesPost"("trending");

-- CreateIndex
CREATE INDEX "ThinkpagesPost_visibility_idx" ON "ThinkpagesPost"("visibility");

-- CreateIndex
CREATE INDEX "ThinkpagesPost_postType_idx" ON "ThinkpagesPost"("postType");

-- CreateIndex
CREATE INDEX "ThinkpagesPost_parentPostId_idx" ON "ThinkpagesPost"("parentPostId");

-- CreateIndex
CREATE INDEX "PostReaction_postId_idx" ON "PostReaction"("postId");

-- CreateIndex
CREATE INDEX "PostReaction_accountId_idx" ON "PostReaction"("accountId");

-- CreateIndex
CREATE INDEX "PostReaction_reactionType_idx" ON "PostReaction"("reactionType");

-- CreateIndex
CREATE UNIQUE INDEX "PostReaction_postId_accountId_key" ON "PostReaction"("postId", "accountId");

-- CreateIndex
CREATE INDEX "PostMention_postId_idx" ON "PostMention"("postId");

-- CreateIndex
CREATE INDEX "PostMention_mentionedAccountId_idx" ON "PostMention"("mentionedAccountId");

-- CreateIndex
CREATE INDEX "MediaAttachment_postId_idx" ON "MediaAttachment"("postId");

-- CreateIndex
CREATE INDEX "MediaAttachment_type_idx" ON "MediaAttachment"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TrendingTopic_hashtag_key" ON "TrendingTopic"("hashtag");

-- CreateIndex
CREATE INDEX "TrendingTopic_hashtag_idx" ON "TrendingTopic"("hashtag");

-- CreateIndex
CREATE INDEX "TrendingTopic_postCount_idx" ON "TrendingTopic"("postCount");

-- CreateIndex
CREATE INDEX "TrendingTopic_engagement_idx" ON "TrendingTopic"("engagement");

-- CreateIndex
CREATE INDEX "TrendingTopic_isActive_idx" ON "TrendingTopic"("isActive");

-- CreateIndex
CREATE INDEX "CountryMoodMetric_countryId_idx" ON "CountryMoodMetric"("countryId");

-- CreateIndex
CREATE INDEX "CountryMoodMetric_timestamp_idx" ON "CountryMoodMetric"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "CountryMoodMetric_countryId_timestamp_key" ON "CountryMoodMetric"("countryId", "timestamp");
