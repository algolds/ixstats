-- Map Editor Tables Migration
-- Creates subdivisions, cities, and points_of_interest tables
-- Run with: psql -h localhost -p 5433 -U postgres -d ixstats -f add-map-editor-tables.sql

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Subdivisions Table
CREATE TABLE IF NOT EXISTS "subdivisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "level" INTEGER NOT NULL,
    "population" DOUBLE PRECISION,
    "capital" TEXT,
    "areaSqKm" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geom_postgis" geometry(Geometry, 4326),

    CONSTRAINT "subdivisions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Subdivisions Indexes
CREATE INDEX IF NOT EXISTS "subdivisions_countryId_status_idx" ON "subdivisions"("countryId", "status");
CREATE INDEX IF NOT EXISTS "subdivisions_status_createdAt_idx" ON "subdivisions"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_subdivision_geom" ON "subdivisions" USING GIST ("geom_postgis");

-- Cities Table
CREATE TABLE IF NOT EXISTS "cities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "subdivisionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "population" DOUBLE PRECISION,
    "isNationalCapital" BOOLEAN NOT NULL DEFAULT false,
    "isSubdivisionCapital" BOOLEAN NOT NULL DEFAULT false,
    "elevation" DOUBLE PRECISION,
    "foundedYear" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geom_postgis" geometry(Point, 4326),

    CONSTRAINT "cities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cities_subdivisionId_fkey" FOREIGN KEY ("subdivisionId") REFERENCES "subdivisions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Cities Indexes
CREATE INDEX IF NOT EXISTS "cities_countryId_status_idx" ON "cities"("countryId", "status");
CREATE INDEX IF NOT EXISTS "cities_type_isNationalCapital_idx" ON "cities"("type", "isNationalCapital");
CREATE INDEX IF NOT EXISTS "cities_status_createdAt_idx" ON "cities"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_city_geom" ON "cities" USING GIST ("geom_postgis");

-- Points of Interest Table
CREATE TABLE IF NOT EXISTS "points_of_interest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "subdivisionId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "coordinates" JSONB NOT NULL,
    "description" TEXT,
    "images" JSONB,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geom_postgis" geometry(Point, 4326),

    CONSTRAINT "points_of_interest_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "points_of_interest_subdivisionId_fkey" FOREIGN KEY ("subdivisionId") REFERENCES "subdivisions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Points of Interest Indexes
CREATE INDEX IF NOT EXISTS "points_of_interest_countryId_status_category_idx" ON "points_of_interest"("countryId", "status", "category");
CREATE INDEX IF NOT EXISTS "points_of_interest_category_status_idx" ON "points_of_interest"("category", "status");
CREATE INDEX IF NOT EXISTS "points_of_interest_status_createdAt_idx" ON "points_of_interest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_poi_geom" ON "points_of_interest" USING GIST ("geom_postgis");

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Map editor tables created successfully!';
    RAISE NOTICE '  - subdivisions';
    RAISE NOTICE '  - cities';
    RAISE NOTICE '  - points_of_interest';
END $$;
