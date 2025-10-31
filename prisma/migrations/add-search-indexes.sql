-- Add Search Performance Indexes
-- Created: 2025-10-31
-- Purpose: Optimize search queries for map editor and location lookups

-- Country name index for quick country searches
CREATE INDEX IF NOT EXISTS idx_country_name ON "Country"(name);

-- Subdivision name index (approved only for public searches) - Already exists
-- CREATE INDEX IF NOT EXISTS idx_subdivision_name ON subdivisions(name) WHERE status = 'approved';

-- City name index (approved only for public searches) - Already exists
-- CREATE INDEX IF NOT EXISTS idx_city_name ON cities(name) WHERE status = 'approved';

-- POI name index (approved only for public searches) - Already exists
-- CREATE INDEX IF NOT EXISTS idx_poi_name ON points_of_interest(name) WHERE status = 'approved';

-- Additional performance indexes for common queries (using correct camelCase column names)
CREATE INDEX IF NOT EXISTS idx_subdivision_country_approved ON subdivisions("countryId") WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_city_country_approved ON cities("countryId") WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_poi_country_approved ON points_of_interest("countryId") WHERE status = 'approved';

-- Note: Spatial indexes already exist as idx_subdivision_geom, idx_city_geom, idx_poi_geom
-- using the geom_postgis column (geometry type, not jsonb)
