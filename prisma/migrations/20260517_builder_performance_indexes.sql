-- Performance Optimization: Builder System Indexes
-- Date: 2026-05-17
-- Purpose: Add missing indexes for builder system performance
-- Phase 1 of Builder System Performance Audit

-- ============================================================================
-- Task 1.1: TaxComponent Compound Index
-- ============================================================================
-- Issue: TaxComponent was missing the compound index that GovernmentComponent
-- and EconomicComponent both have, causing slower queries when filtering by
-- countryId + componentType + isActive together.
-- 
-- This index supports queries like:
--   SELECT * FROM "TaxComponent" WHERE countryId = ? AND componentType = ? AND isActive = true

CREATE INDEX IF NOT EXISTS "TaxComponent_countryId_componentType_isActive_idx" 
  ON "TaxComponent"("countryId", "componentType", "isActive");

-- ============================================================================
-- Task 1.2: ComponentSynergy FK Indexes
-- ============================================================================
-- Issue: ComponentSynergy had a unique constraint on (primaryComponentId, secondaryComponentId)
-- but no individual indexes on these foreign keys. JOINs on these columns were
-- performing sequential scans instead of using indexes.
--
-- These indexes support:
--   - Synergy lookups by primary component (government.ts effectiveness calculations)
--   - Reverse synergy lookups by secondary component
--   - CASCADE delete operations when components are removed

CREATE INDEX IF NOT EXISTS "ComponentSynergy_primaryComponentId_idx" 
  ON "ComponentSynergy"("primaryComponentId");

CREATE INDEX IF NOT EXISTS "ComponentSynergy_secondaryComponentId_idx" 
  ON "ComponentSynergy"("secondaryComponentId");

-- ============================================================================
-- Verification Queries (run manually to confirm indexes exist)
-- ============================================================================
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'TaxComponent';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ComponentSynergy';
