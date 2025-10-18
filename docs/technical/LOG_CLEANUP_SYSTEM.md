# IxStats Log and Report Cleanup System

This document describes the automated log and report cleanup system for IxStats, designed to maintain optimal system performance and manage storage efficiently.

## Overview

The cleanup system automatically manages logs and audit reports to:
- **Prevent storage bloat**: Remove old files and truncate large ones
- **Maintain AI compatibility**: Keep files under 10,000 lines for optimal AI processing
- **Preserve recent data**: Keep the most recent and relevant information
- **Automate maintenance**: Run daily without manual intervention

## Components

### 1. TypeScript Cleanup Script (`scripts/cleanup-logs.ts`)
- **Purpose**: Full-featured cleanup with detailed logging and error handling
- **Usage**: `npm run cleanup:logs`
- **Features**: 
  - Comprehensive file analysis
  - Detailed progress reporting
  - Error handling and recovery
  - Statistics and space savings reporting

### 2. Shell Cleanup Script (`scripts/cleanup-logs.sh`)
- **Purpose**: Lightweight, cron-friendly cleanup script
- **Usage**: `./scripts/cleanup-logs.sh`
- **Features**:
  - Fast execution
  - Minimal dependencies
  - Cron job compatible
  - System integration ready

### 3. Cron Setup Script (`scripts/setup-cron-cleanup.sh`)
- **Purpose**: Configure automated daily cleanup
- **Usage**: `./scripts/setup-cron-cleanup.sh [setup|remove|status|help]`
- **Features**:
  - Easy cron job management
  - Status monitoring
  - Log file tracking

## Cleanup Rules

### File Age Management
- **Log files**: Deleted after 3 days
- **Audit reports**: Deleted after 3 days
- **Node modules logs**: Deleted immediately (yarn-error.log, npm-debug.log)

### File Size Management
- **Large files**: Truncated to 10,000 lines (keeps most recent entries)
- **Target files**: All `.json` reports and `.log` files
- **Backup strategy**: Temporary backup during truncation

### Duplicate Management
- **Consolidated reports**: Keep 3 most recent
- **Production issues**: Keep 3 most recent  
- **Live wiring reports**: Keep 3 most recent
- **Selection criteria**: Based on file modification time

## Usage Examples

### Manual Cleanup
```bash
# Run TypeScript version (recommended for development)
npm run cleanup:logs

# Run shell version (recommended for production/cron)
./scripts/cleanup-logs.sh
```

### Automated Setup
```bash
# Set up daily cleanup at 2 AM
./scripts/setup-cron-cleanup.sh setup

# Check status
./scripts/setup-cron-cleanup.sh status

# Remove automation
./scripts/setup-cron-cleanup.sh remove
```

### Monitoring
```bash
# View cleanup logs
tail -f logs/cron-cleanup.log

# Check recent cleanup activity
./scripts/setup-cron-cleanup.sh status
```

## Configuration

### Environment Variables
- `MAX_LINES`: Maximum lines per file (default: 10,000)
- `MAX_AGE_DAYS`: Maximum age in days (default: 3)

### File Locations
- **Reports**: `scripts/audit/reports/`
- **Logs**: `logs/` (created automatically)
- **Cron logs**: `logs/cron-cleanup.log`

## Performance Impact

### Before Cleanup (Example)
- **Total files**: 30+ audit reports
- **Storage used**: ~2.5 MB
- **Largest file**: 13,292 lines (408 KB)
- **Duplicate files**: 20+ redundant reports

### After Cleanup (Example)
- **Total files**: 9 audit reports
- **Storage used**: ~1.2 MB (52% reduction)
- **Largest file**: 2,269 lines (67 KB)
- **Duplicate files**: 0 (kept only 3 most recent per type)

## Safety Features

### Backup Strategy
- Temporary backups during truncation
- Automatic cleanup of backup files
- No permanent data loss

### Error Handling
- Graceful failure handling
- Detailed error reporting
- Non-destructive operations

### Validation
- File existence checks
- Permission validation
- Size verification

## Integration

### Development Workflow
```bash
# Add to package.json scripts
"cleanup:logs": "tsx scripts/cleanup-logs.ts"

# Run during development
npm run cleanup:logs
```

### Production Deployment
```bash
# Set up automated cleanup
./scripts/setup-cron-cleanup.sh setup

# Verify installation
./scripts/setup-cron-cleanup.sh status
```

### CI/CD Integration
```yaml
# Example GitHub Actions step
- name: Clean up logs and reports
  run: ./scripts/cleanup-logs.sh
```

## Troubleshooting

### Common Issues

**Permission Denied**
```bash
# Fix script permissions
chmod +x scripts/cleanup-logs.sh
chmod +x scripts/setup-cron-cleanup.sh
```

**Cron Job Not Running**
```bash
# Check cron service
sudo systemctl status cron

# Verify cron job exists
crontab -l | grep cleanup
```

**Large Files Not Truncated**
```bash
# Check file permissions
ls -la scripts/audit/reports/

# Run with verbose output
./scripts/cleanup-logs.sh 2>&1 | tee cleanup.log
```

### Log Analysis
```bash
# View cleanup statistics
grep "Space saved" logs/cron-cleanup.log

# Check for errors
grep "ERROR\|Failed" logs/cron-cleanup.log

# Monitor file counts
grep "Files deleted\|Files truncated" logs/cron-cleanup.log
```

## Best Practices

### Development
1. Run cleanup before committing large log files
2. Use TypeScript version for detailed analysis
3. Monitor cleanup statistics regularly

### Production
1. Set up automated daily cleanup
2. Monitor cron job execution
3. Review cleanup logs weekly
4. Adjust retention periods as needed

### Maintenance
1. Verify cleanup effectiveness monthly
2. Update retention policies based on storage needs
3. Test cleanup scripts after system updates
4. Document any custom configurations

## Future Enhancements

### Planned Features
- [ ] Configurable retention policies per file type
- [ ] Compression for archived logs
- [ ] Integration with monitoring systems
- [ ] Web dashboard for cleanup statistics
- [ ] Email notifications for cleanup failures

### Customization Options
- [ ] Custom file patterns
- [ ] Multiple retention periods
- [ ] Selective cleanup by file type
- [ ] Integration with external storage

---

**Last Updated**: October 14, 2025  
**Version**: 1.0.0  
**Maintainer**: IxStats Development Team
