# Development Database Setup

## Overview
The development server is now configured to use a copy of the production database, ensuring that development work is done with real production data.

## Configuration Changes

### 1. Development Startup Script (`start-development.sh`)
- **Modified**: Added automatic override of `DATABASE_URL` to use production database
- **Location**: `/ixwiki/public/projects/ixstats/start-development.sh`
- **Change**: `export DATABASE_URL="file:./prisma/prod.db"`

### 2. Database Sync Scripts
- **New Script**: `scripts/sync-prod-to-dev.sh` - Syncs production database to development
- **Package.json**: Added `npm run db:sync:dev-from-prod` command
- **Purpose**: Keep development database in sync with production

### 3. Database Files
- **Production DB**: `prisma/prod.db` (2.6M)
- **Development DB**: `prisma/dev.db` (synced from production)
- **Backup**: `prisma/dev-prod-copy.db` (additional copy)

## Usage

### Starting Development Server
```bash
npm run dev
# or
./start-development.sh
```

The development server will automatically use the production database (`prisma/prod.db`).

### Syncing Production Data to Development
```bash
# Sync production database to development
npm run db:sync:dev-from-prod

# Or run the script directly
./scripts/sync-prod-to-dev.sh
```

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
   Database: file:./prisma/prod.db (Production Database Copy)
   Port: 3000
```

### Verify Database Sync
```bash
# Check database sizes match
ls -la prisma/*.db

# Validate database schema
DATABASE_URL="file:./prisma/prod.db" npx prisma validate
```

## Benefits

1. **Real Data**: Development work with actual production data
2. **Data Consistency**: No discrepancies between dev and prod
3. **Realistic Testing**: Features tested with real user data
4. **Easy Sync**: Simple commands to keep databases in sync

## Important Notes

- **Data Safety**: Production database is read-only in development
- **Backups**: Development database is backed up before sync operations
- **Size**: Production database is 2.6M (manageable for development)
- **Performance**: Development server performance may be affected by larger database

## Troubleshooting

### If Production Database is Missing
```bash
# Check if production database exists
ls -la prisma/prod.db

# If missing, restore from backup or sync from another source
```

### If Development Server Won't Start
```bash
# Check database file permissions
ls -la prisma/prod.db

# Verify database integrity
DATABASE_URL="file:./prisma/prod.db" npx prisma validate
```

### Reset to Development Database
```bash
# If you need to use a separate development database
# Edit start-development.sh and change DATABASE_URL back to dev.db
```
