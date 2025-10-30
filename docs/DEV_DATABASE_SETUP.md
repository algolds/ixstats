# Development Database Setup

> **MIGRATION NOTICE (October 2025)**: IxStats has migrated from SQLite to PostgreSQL. This document reflects the legacy SQLite setup and is preserved for historical reference. For current PostgreSQL setup instructions, see `docs/operations/database.md`.

## Overview
The development server is now configured to use a copy of the production database, ensuring that development work is done with real production data.

## Configuration Changes

### 1. Development Startup Script (`start-development.sh`)
- **Legacy (SQLite)**: Previously used `export DATABASE_URL="file:./prisma/prod.db"`
- **Current (PostgreSQL)**: Now uses `postgresql://ixstats:ixstats@localhost:5433/ixstats?schema=public`
- **Location**: `/ixwiki/public/projects/ixstats/start-development.sh`

### 2. Database Sync Scripts
- **New Script**: `scripts/sync-prod-to-dev.sh` - Syncs production database to development
- **Package.json**: Added `npm run db:sync:dev-from-prod` command
- **Purpose**: Keep development database in sync with production

### 3. Database Files (Legacy SQLite)
- **Legacy Production DB**: `prisma/prod.db` (2.6M) - No longer used
- **Legacy Development DB**: `prisma/dev.db` - No longer used
- **Current Database**: PostgreSQL at `localhost:5433/ixstats`

## Usage

### Starting Development Server
```bash
npm run dev
# or
./start-development.sh
```

The development server will automatically connect to the PostgreSQL database at `localhost:5433/ixstats`.

### Syncing Production Data to Development
> **Note**: These SQLite-era commands are deprecated. PostgreSQL uses standard database backup/restore tools.

### Database Management
```bash
# View production database
npm run db:studio:prod

# Backup current development database
npm run db:backup

# Restore from backup
npm run db:restore
```

## Verification

### Check Database Configuration
The development startup script will show:
```
🔍 Development Environment Summary:
   NODE_ENV: development
   Database: postgresql://localhost:5433/ixstats (PostgreSQL)
   Port: 3000
```

### Verify Database Connection
```bash
# Check database connection
psql -h localhost -p 5433 -U ixstats -d ixstats -c "\dt"

# Validate database schema
npx prisma validate
```

## Benefits (PostgreSQL Migration)

1. **Better Performance**: PostgreSQL offers superior query performance
2. **PostGIS Support**: Native geographic data handling for map features
3. **Production Parity**: Both dev and prod use the same database engine
4. **Standard Tooling**: Use industry-standard PostgreSQL tools

## Important Notes

- **Database Engine**: PostgreSQL 15+ required (port 5433)
- **Connection Pooling**: Configured via DATABASE_URL parameters
- **Migrations**: Use `npx prisma migrate dev` for schema changes
- **Backups**: Use `pg_dump` for PostgreSQL backups

## Troubleshooting (PostgreSQL)

### If PostgreSQL Connection Fails
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Verify port 5433 is listening
sudo lsof -i :5433

# Test connection manually
psql -h localhost -p 5433 -U ixstats -d ixstats
```

### If Schema Issues Occur
```bash
# Reset database (WARNING: destroys all data)
npx prisma migrate reset

# Apply pending migrations
npx prisma migrate deploy

# Verify schema
npx prisma validate
```

### Legacy SQLite Files
```bash
# Old SQLite files can be safely archived or deleted
# They are located in prisma/backups/sqlite-legacy/
```
