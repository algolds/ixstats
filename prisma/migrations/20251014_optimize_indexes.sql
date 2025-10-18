-- Performance Optimization Migration
-- Date: 2025-10-14
-- Purpose: Add critical indexes for production performance

-- Country table optimizations
CREATE INDEX IF NOT EXISTS "Country_slug_idx" ON "Country"("slug");
CREATE INDEX IF NOT EXISTS "Country_economicTier_idx" ON "Country"("economicTier");
CREATE INDEX IF NOT EXISTS "Country_populationTier_idx" ON "Country"("populationTier");
CREATE INDEX IF NOT EXISTS "Country_continent_region_idx" ON "Country"("continent", "region");
CREATE INDEX IF NOT EXISTS "Country_lastCalculated_idx" ON "Country"("lastCalculated");
CREATE INDEX IF NOT EXISTS "Country_currentPopulation_idx" ON "Country"("currentPopulation");
CREATE INDEX IF NOT EXISTS "Country_currentTotalGdp_idx" ON "Country"("currentTotalGdp");

-- User table optimizations
CREATE INDEX IF NOT EXISTS "User_clerkUserId_idx" ON "User"("clerkUserId");
CREATE INDEX IF NOT EXISTS "User_countryId_idx" ON "User"("countryId");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");

-- ThinkPages optimizations
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_accountId_createdAt_idx" ON "ThinkpagesPost"("accountId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_visibility_trending_idx" ON "ThinkpagesPost"("visibility", "trending");
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_ixTimeTimestamp_idx" ON "ThinkpagesPost"("ixTimeTimestamp" DESC);
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_pinned_createdAt_idx" ON "ThinkpagesPost"("pinned" DESC, "createdAt" DESC);

-- Intelligence optimizations
CREATE INDEX IF NOT EXISTS "IntelligenceItem_category_priority_idx" ON "IntelligenceItem"("category", "priority" DESC);
CREATE INDEX IF NOT EXISTS "IntelligenceItem_timestamp_active_idx" ON "IntelligenceItem"("timestamp" DESC, "isActive");
CREATE INDEX IF NOT EXISTS "IntelligenceItem_affectedCountries_idx" ON "IntelligenceItem"("affectedCountries");

-- Activity Feed optimizations
CREATE INDEX IF NOT EXISTS "ActivityFeed_createdAt_idx" ON "ActivityFeed"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityFeed_countryId_createdAt_idx" ON "ActivityFeed"("countryId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityFeed_userId_createdAt_idx" ON "ActivityFeed"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityFeed_category_priority_idx" ON "ActivityFeed"("category", "priority");

-- Embassy optimizations
CREATE INDEX IF NOT EXISTS "Embassy_hostCountryId_guestCountryId_idx" ON "Embassy"("hostCountryId", "guestCountryId");
CREATE INDEX IF NOT EXISTS "Embassy_status_level_idx" ON "Embassy"("status", "level");
CREATE INDEX IF NOT EXISTS "Embassy_lastActivity_idx" ON "Embassy"("lastActivity" DESC);

-- Government Component optimizations
CREATE INDEX IF NOT EXISTS "GovernmentComponent_countryId_type_idx" ON "GovernmentComponent"("countryId", "componentType");
CREATE INDEX IF NOT EXISTS "GovernmentComponent_isActive_idx" ON "GovernmentComponent"("isActive");
CREATE INDEX IF NOT EXISTS "GovernmentComponent_effectivenessScore_idx" ON "GovernmentComponent"("effectivenessScore" DESC);

-- Notification optimizations
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_category_priority_idx" ON "Notification"("category", "priority" DESC);
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt" DESC);

-- Wiki Cache optimizations
CREATE INDEX IF NOT EXISTS "WikiCache_type_countryName_idx" ON "WikiCache"("type", "countryName");
CREATE INDEX IF NOT EXISTS "WikiCache_expiresAt_idx" ON "WikiCache"("expiresAt");
CREATE INDEX IF NOT EXISTS "WikiCache_hitCount_idx" ON "WikiCache"("hitCount" DESC);

-- Historical Data optimizations
CREATE INDEX IF NOT EXISTS "HistoricalDataPoint_countryId_ixTime_idx" ON "HistoricalDataPoint"("countryId", "ixTimeTimestamp" DESC);
CREATE INDEX IF NOT EXISTS "HistoricalDataPoint_dataType_idx" ON "HistoricalDataPoint"("dataType");

-- Audit Log optimizations
CREATE INDEX IF NOT EXISTS "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_countryId_timestamp_idx" ON "AuditLog"("countryId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp" DESC);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS "Country_economic_population_tiers_idx" ON "Country"("economicTier", "populationTier");
CREATE INDEX IF NOT EXISTS "User_country_active_idx" ON "User"("countryId", "isActive");
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_country_visibility_time_idx" ON "ThinkpagesPost"("accountId", "visibility", "createdAt" DESC);

-- Partial indexes for better performance
CREATE INDEX IF NOT EXISTS "Country_active_countries_idx" ON "Country"("slug") WHERE "currentPopulation" > 0;
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_public_posts_idx" ON "ThinkpagesPost"("createdAt" DESC) WHERE "visibility" = 'public';
CREATE INDEX IF NOT EXISTS "Notification_unread_idx" ON "Notification"("userId", "createdAt" DESC) WHERE "read" = false;

-- Covering indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Country_dashboard_covering_idx" ON "Country"("id", "name", "slug", "continent", "region", "economicTier", "populationTier", "currentPopulation", "currentTotalGdp");
CREATE INDEX IF NOT EXISTS "User_profile_covering_idx" ON "User"("id", "clerkUserId", "countryId", "roleId", "membershipTier", "isActive");
