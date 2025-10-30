#!/bin/bash
set -e

echo "Setting up PostGIS support..."

# Check if PostGIS is already enabled
POSTGIS_ENABLED=$(sudo -u postgres psql -p 5433 -d ixstats -tAc "SELECT COUNT(*) FROM pg_extension WHERE extname='postgis'")

if [ "$POSTGIS_ENABLED" -eq "0" ]; then
  echo "Enabling PostGIS extension..."
  sudo -u postgres psql -p 5433 -d ixstats -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  sudo -u postgres psql -p 5433 -d ixstats -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
else
  echo "PostGIS already enabled ✓"
fi

echo "Running PostGIS migration..."
sudo -u postgres psql -p 5433 -d ixstats -f prisma/migrations/add-postgis-support.sql

echo "PostGIS setup complete ✓"
