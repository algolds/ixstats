-- Migration: Add Full-Text Search Indexes for Map Entities
-- Created: 2025-11-02
-- Purpose: Optimize search performance for subdivisions, cities, and POIs

-- Create full-text search index for subdivisions (name field)
CREATE INDEX IF NOT EXISTS idx_subdivision_name_fulltext ON subdivisions USING GIN (to_tsvector('english', name));

-- Create full-text search index for cities (name field)
CREATE INDEX IF NOT EXISTS idx_city_name_fulltext ON cities USING GIN (to_tsvector('english', name));

-- Create full-text search index for POIs (name + description fields)
CREATE INDEX IF NOT EXISTS idx_poi_name_fulltext ON points_of_interest USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_poi_description_fulltext ON points_of_interest USING GIN (to_tsvector('english', COALESCE(description, '')));

-- Composite full-text index for POIs (combined name + description for richer search)
CREATE INDEX IF NOT EXISTS idx_poi_combined_fulltext ON points_of_interest USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Add performance indexes for common WHERE clauses
CREATE INDEX IF NOT EXISTS idx_subdivision_country_status ON subdivisions (country_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_city_country_status ON cities (country_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poi_country_status ON points_of_interest (country_id, status, created_at DESC);

-- Add indexes for admin review queries
CREATE INDEX IF NOT EXISTS idx_subdivision_pending_review ON subdivisions (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_city_pending_review ON cities (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_poi_pending_review ON points_of_interest (status, created_at) WHERE status = 'pending';

-- Add performance index for user's submissions
CREATE INDEX IF NOT EXISTS idx_subdivision_user_submissions ON subdivisions (submitted_by, country_id, status);
CREATE INDEX IF NOT EXISTS idx_city_user_submissions ON cities (submitted_by, country_id, status);
CREATE INDEX IF NOT EXISTS idx_poi_user_submissions ON points_of_interest (submitted_by, country_id, status);

-- Add index for national capitals queries
CREATE INDEX IF NOT EXISTS idx_city_national_capital ON cities (is_national_capital, status) WHERE is_national_capital = true;

-- Add index for subdivision capitals queries
CREATE INDEX IF NOT EXISTS idx_city_subdivision_capital ON cities (is_subdivision_capital, subdivision_id, status) WHERE is_subdivision_capital = true;

COMMENT ON INDEX idx_subdivision_name_fulltext IS 'Full-text search index for subdivision names';
COMMENT ON INDEX idx_city_name_fulltext IS 'Full-text search index for city names';
COMMENT ON INDEX idx_poi_name_fulltext IS 'Full-text search index for POI names';
COMMENT ON INDEX idx_poi_description_fulltext IS 'Full-text search index for POI descriptions';
COMMENT ON INDEX idx_poi_combined_fulltext IS 'Combined full-text search index for POI names and descriptions';
