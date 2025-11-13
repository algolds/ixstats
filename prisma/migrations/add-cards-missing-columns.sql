-- Add missing columns to cards table for NS import support
-- Migration: add-cards-missing-columns.sql
-- Date: 2025-11-11

-- Add name column (for alternate card naming)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS name TEXT;

-- Add metadata column (for storing complete NS API data)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index on metadata for faster JSON queries
CREATE INDEX IF NOT EXISTS cards_metadata_idx ON cards USING GIN (metadata);

-- Add comment to explain the columns
COMMENT ON COLUMN cards.name IS 'Alternate card name field for NS imports';
COMMENT ON COLUMN cards.metadata IS 'Complete metadata from NS API and other sources (JSON)';



