# Database Management Guide

**Version**: v1.1.1
**Last Updated**: October 17, 2025

This guide covers database synchronization between development and production environments.

## Database Statistics

- **Total Models**: 131 models
- **Total Migrations**: 9 migrations
- **Latest Migration**: `20251017203807_add_atomic_integration`
- **Database Type**: SQLite (dev/prod), PostgreSQL (production-ready)

## Overview

IxStats uses SQLite databases for both development and production:
- **Development**: `./prisma/dev.db`
- **Production**: `./prisma/prod.db`

The production database is **automatically kept in sync** with schema changes through multiple mechanisms.

---

## Automatic Synchronization

### 1. On Deployment (Automatic)

Every time you deploy to production, the database schema is automatically synced:

```bash
npm run deploy:prod
# or
./scripts/deploy-production.sh
```

The deployment script automatically:
1. Generates Prisma client
2. Syncs production database with current schema
3. Creates backup of prod database before changes
4. Builds and starts the application

### 2. Schema Watcher (Development)

During development, you can run a watcher that automatically syncs prod DB when schema changes:

```bash
npm run db:watch
```

This will:
- Monitor `prisma/schema.prisma` for changes
- Automatically sync prod database when changes are detected
- Show sync status in real-time

---

## Manual Synchronization

### Sync Prod Database Now

Force an immediate sync of prod database with current schema:

```bash
npm run db:sync
```

This command:
- ✅ Backs up current prod database
- ✅ Pushes schema changes to prod
- ✅ Verifies sync completed successfully

### Check Sync Status

Verify that prod database matches the schema:

```bash
npm run db:sync:check
```

---

## Database Commands

### Development Database

```bash
# Setup dev database (generate + push + init)
npm run db:setup

# Push schema changes to dev
npm run db:push

# Reset dev database
npm run db:reset

# Open dev database in Prisma Studio
npm run db:studio
```

### Production Database

```bash
# Push schema to prod (via sync script)
npm run db:sync

# Push schema to prod (direct)
npm run db:push:prod

# Run migrations on prod
npm run db:migrate:prod

# Open prod database in Prisma Studio
npm run db:studio:prod

# Backup prod database
npm run db:backup
```

---

## Database Migration Workflow

### Making Schema Changes

1. **Edit Schema**: Modify `prisma/schema.prisma`

2. **Sync to Dev**: Push changes to dev database
   ```bash
   npm run db:push
   ```

3. **Sync to Prod**: Either:
   - **Automatic**: Just deploy
     ```bash
     npm run deploy:prod
     ```
   - **Manual**: Run sync command
     ```bash
     npm run db:sync
     ```

### Creating Migrations (Optional)

For version-controlled schema changes:

```bash
# Create a new migration
npm run db:migrate

# Deploy migrations to prod
npm run db:migrate:prod
```

---

## Backup & Recovery

### Automatic Backups

Backups are automatically created:
- **On sync**: Before any schema changes to prod
- **Location**: `./prisma/backups/prod.db.backup.TIMESTAMP`

### Manual Backup

```bash
npm run db:backup
```

### Restore from Backup

```bash
npm run db:restore
```

---

## Troubleshooting

### Prod Database Out of Sync

**Symptom**: Errors like "table does not exist" in production

**Solution**:
```bash
# Force sync production database
npm run db:sync

# Restart production server
pm2 restart ixstats
```

### Schema Validation Errors

**Symptom**: Migration or push fails with validation errors

**Solution**:
```bash
# Check schema syntax
npx prisma validate

# If valid, force push
npm run db:push:prod
```

### Lost Production Data

**Symptom**: Need to restore from backup

**Solution**:
```bash
# List available backups
ls -lh ./prisma/backups/

# Restore specific backup
cp ./prisma/backups/prod.db.backup.YYYYMMDD_HHMMSS ./prisma/prod.db

# Restart server
pm2 restart ixstats
```

---

## Best Practices

### ✅ Do's

- **Always test schema changes in dev first**
- **Run `db:sync` before deploying** if you made schema changes
- **Use `db:watch` during active development** for automatic syncing
- **Review backups regularly** and clean up old ones
- **Use migrations** for major schema changes in production

### ❌ Don'ts

- **Don't manually edit the database** without updating the schema
- **Don't skip the sync step** when deploying schema changes
- **Don't delete backups** without verifying prod database is healthy
- **Don't use `db:reset`** on production (it clears all data!)

---

## Integration with Deployment

The production deployment script (`./scripts/deploy-production.sh`) automatically:

1. Loads production environment variables
2. Validates database configuration
3. Generates Prisma client
4. **Syncs production database** ← Automatic!
5. Builds the application
6. Starts/restarts the server

No manual intervention needed for database sync during deployment!

---

## Monitoring

### Check Database Status

```bash
# Verify prod database exists
ls -lh ./prisma/prod.db

# Check schema is valid
npx prisma validate

# View database in browser
npm run db:studio:prod
```

### View Logs

Database sync logs are shown during:
- Deployment (`./scripts/deploy-production.sh`)
- Manual sync (`npm run db:sync`)
- Schema watching (`npm run db:watch`)

---

## Quick Reference

| Task | Command |
|------|---------|
| Sync prod database | `npm run db:sync` |
| Watch for schema changes | `npm run db:watch` |
| Check sync status | `npm run db:sync:check` |
| Open prod database | `npm run db:studio:prod` |
| Backup prod database | `npm run db:backup` |
| Deploy with auto-sync | `npm run deploy:prod` |

---

## Need Help?

If you encounter issues:
1. Check this guide for common solutions
2. Review deployment logs for error messages
3. Verify backups are available
4. Check Prisma schema syntax with `npx prisma validate`

For persistent issues, manually sync and restart:
```bash
npm run db:sync && pm2 restart ixstats
```

