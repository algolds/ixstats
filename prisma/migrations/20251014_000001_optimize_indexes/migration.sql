-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_slug_idx" ON "Country"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_economicTier_idx" ON "Country"("economicTier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_populationTier_idx" ON "Country"("populationTier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_continent_region_idx" ON "Country"("continent", "region");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_lastCalculated_idx" ON "Country"("lastCalculated");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_currentPopulation_idx" ON "Country"("currentPopulation");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_currentTotalGdp_idx" ON "Country"("currentTotalGdp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_clerkUserId_idx" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_countryId_idx" ON "User"("countryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_accountId_createdAt_idx" ON "ThinkpagesPost"("accountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_visibility_trending_idx" ON "ThinkpagesPost"("visibility", "trending");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_ixTimeTimestamp_idx" ON "ThinkpagesPost"("ixTimeTimestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_pinned_createdAt_idx" ON "ThinkpagesPost"("pinned" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntelligenceItem_category_priority_idx" ON "IntelligenceItem"("category", "priority" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntelligenceItem_timestamp_active_idx" ON "IntelligenceItem"("timestamp" DESC, "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntelligenceItem_affectedCountries_idx" ON "IntelligenceItem"("affectedCountries");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityFeed_createdAt_idx" ON "ActivityFeed"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityFeed_countryId_createdAt_idx" ON "ActivityFeed"("countryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityFeed_userId_createdAt_idx" ON "ActivityFeed"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityFeed_category_priority_idx" ON "ActivityFeed"("category", "priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Embassy_hostCountryId_guestCountryId_idx" ON "Embassy"("hostCountryId", "guestCountryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Embassy_status_level_idx" ON "Embassy"("status", "level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Embassy_lastActivity_idx" ON "Embassy"("lastActivity" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GovernmentComponent_countryId_type_idx" ON "GovernmentComponent"("countryId", "componentType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GovernmentComponent_isActive_idx" ON "GovernmentComponent"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GovernmentComponent_effectivenessScore_idx" ON "GovernmentComponent"("effectivenessScore" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_category_priority_idx" ON "Notification"("category", "priority" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WikiCache_type_countryName_idx" ON "WikiCache"("type", "countryName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WikiCache_expiresAt_idx" ON "WikiCache"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WikiCache_hitCount_idx" ON "WikiCache"("hitCount" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HistoricalDataPoint_countryId_ixTime_idx" ON "HistoricalDataPoint"("countryId", "ixTimeTimestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HistoricalDataPoint_dataType_idx" ON "HistoricalDataPoint"("dataType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_countryId_timestamp_idx" ON "AuditLog"("countryId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_economic_population_tiers_idx" ON "Country"("economicTier", "populationTier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_country_active_idx" ON "User"("countryId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_country_visibility_time_idx" ON "ThinkpagesPost"("accountId", "visibility", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Country_active_countries_idx" ON "Country"("slug") WHERE "currentPopulation" > 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThinkpagesPost_public_posts_idx" ON "ThinkpagesPost"("createdAt" DESC) WHERE "visibility" = 'public';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_unread_idx" ON "Notification"("userId", "createdAt" DESC) WHERE "read" = false;
