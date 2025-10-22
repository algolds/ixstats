# Pre-Deployment Checklist for IxStats v1.2

This checklist ensures all required steps are completed before production deployment on November 1, 2025.

## Deployment Information

- **Target Date**: November 1, 2025
- **Version**: v1.2.0
- **Deployment Window**: TBD (recommended: low-traffic hours)
- **Expected Downtime**: 5-15 minutes
- **Rollback Time**: ~3-5 minutes

---

## 1. Environment Configuration

### 1.1 Environment Variables
- [ ] `.env.production` file exists and is properly configured
- [ ] All required environment variables are present (run `npm run verify:environment`)
- [ ] `DATABASE_URL` points to production database (PostgreSQL preferred)
- [ ] `NODE_ENV` is set to `production`
- [ ] `BASE_PATH` is set to `/projects/ixstats`
- [ ] `NEXT_PUBLIC_BASE_PATH` matches `BASE_PATH`
- [ ] Clerk production keys configured (not test keys)
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_live_`
  - [ ] `CLERK_SECRET_KEY` starts with `sk_live_`
- [ ] Discord webhook URL configured for production alerts
- [ ] Redis URL configured for production rate limiting (or disabled)
- [ ] `RATE_LIMIT_ENABLED` is set appropriately
- [ ] IxTime bot URL points to production endpoint
- [ ] MediaWiki API URL is correct

### 1.2 Infrastructure
- [ ] Production server has sufficient resources
  - [ ] Minimum 2GB RAM available
  - [ ] Minimum 10GB disk space available
  - [ ] CPU usage below 70%
- [ ] Node.js version >= 18.17.0 installed
- [ ] npm version >= 9.0.0 installed
- [ ] PostgreSQL database is running (if using external DB)
- [ ] Redis server is running (if rate limiting enabled)
- [ ] Port 3550 is available and properly configured

---

## 2. Code & Dependencies

### 2.1 Code Quality
- [ ] All TypeScript errors resolved (`npm run typecheck`)
- [ ] Build completes successfully (`npm run build`)
- [ ] No console errors during build
- [ ] All tests passing (`npm run test:critical`)
- [ ] Code reviewed and approved

### 2.2 Dependencies
- [ ] `npm audit` run and critical/high vulnerabilities addressed
- [ ] All dependencies are up to date or documented if not
- [ ] `package-lock.json` is committed
- [ ] No development dependencies in production bundle

---

## 3. Database

### 3.1 Database Status
- [ ] Database backup completed successfully
- [ ] Backup stored in secure location: `/ixwiki/public/projects/ixstats/prisma/backups/`
- [ ] Backup tested and can be restored
- [ ] All pending migrations reviewed: `prisma migrate status`
- [ ] Migration safety validated: `npm run validate:migrations`
- [ ] Database schema aligns with Prisma schema: `npm run validate:schemas`
- [ ] Database connection tested from production server

### 3.2 Data Integrity
- [ ] Critical data integrity checks passed: `npm run test:db`
- [ ] No orphaned records or constraint violations
- [ ] User roles and permissions verified
- [ ] Country data verified: `npm run audit:country-links`

---

## 4. Security

### 4.1 Security Audit
- [ ] Security scan completed (no critical issues)
- [ ] All admin endpoints have proper authentication
- [ ] Rate limiting configured and tested
- [ ] CORS settings reviewed for production
- [ ] Security headers configured (helmet)
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection enabled

### 4.2 Authentication & Authorization
- [ ] Clerk production instance configured correctly
- [ ] RBAC (Role-Based Access Control) working properly
- [ ] Admin users identified and roles assigned
- [ ] System owner account configured
- [ ] Session management working correctly
- [ ] Webhook signatures validated

### 4.3 Secrets Management
- [ ] No secrets in codebase (checked with grep)
- [ ] All API keys stored in environment variables
- [ ] `.env.production` file has proper permissions (600)
- [ ] Sensitive files added to `.gitignore`

---

## 5. Performance

### 5.1 Performance Baseline
- [ ] Performance baseline established (page load times)
- [ ] Database query performance profiled
- [ ] Bundle size analyzed and optimized
- [ ] Lighthouse score documented (target: >90)
- [ ] Core Web Vitals measured:
  - [ ] LCP (Largest Contentful Paint) < 2.5s
  - [ ] FID (First Input Delay) < 100ms
  - [ ] CLS (Cumulative Layout Shift) < 0.1

### 5.2 Optimization
- [ ] Compression enabled (`ENABLE_COMPRESSION=true`)
- [ ] Caching configured (`ENABLE_CACHING=true`)
- [ ] Static assets optimized
- [ ] Images optimized and using Next.js Image component
- [ ] Unnecessary console.logs removed from production code

---

## 6. Monitoring & Alerts

### 6.1 Monitoring Setup
- [ ] Discord webhook alerts configured
- [ ] Error tracking operational
- [ ] Performance monitoring active
- [ ] Rate limiting alerts configured
- [ ] Database performance monitoring enabled
- [ ] Uptime monitoring configured (external service recommended)

### 6.2 Logging
- [ ] Application logs configured
- [ ] Log rotation configured
- [ ] Error logs properly formatted
- [ ] Audit logs enabled for sensitive operations
- [ ] Log storage location has sufficient space

---

## 7. External Integrations

### 7.1 API Integrations
- [ ] IxWiki API connection tested
- [ ] Discord bot integration verified
- [ ] Flag service API working
- [ ] IxTime synchronization operational
- [ ] All external API endpoints responding

### 7.2 Webhooks
- [ ] Discord webhook tested and receiving messages
- [ ] Webhook failure handling implemented
- [ ] Webhook rate limits documented

---

## 8. Documentation

### 8.1 Technical Documentation
- [ ] API documentation updated (`docs/API_REFERENCE.md`)
- [ ] Deployment procedures documented
- [ ] Environment variables documented (`.env.example`)
- [ ] Rollback procedures documented
- [ ] Troubleshooting guide available

### 8.2 User Documentation
- [ ] Release notes prepared for v1.2
- [ ] User-facing changes documented
- [ ] Known issues documented
- [ ] Migration guide created (if applicable)

---

## 9. Testing

### 9.1 Automated Tests
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] API endpoint tests passing (`npm run test:health`)
- [ ] Database CRUD operations verified (`npm run test:crud`)
- [ ] Economic calculations verified (`npm run test:economics`)
- [ ] Live data wiring verified (`npm run test:wiring`)

### 9.2 Manual Testing
- [ ] Login/authentication flow tested
- [ ] Country builder workflow tested
- [ ] MyCountry dashboard tested
- [ ] ThinkPages social platform tested
- [ ] Intelligence system tested
- [ ] Diplomatic features tested
- [ ] Economic calculations verified
- [ ] Mobile responsiveness tested
- [ ] Cross-browser compatibility tested (Chrome, Firefox, Safari, Edge)

### 9.3 Staging Validation
- [ ] Full deployment tested on staging environment
- [ ] Smoke tests passed on staging
- [ ] Performance acceptable on staging
- [ ] No critical errors in staging logs

---

## 10. Team Communication

### 10.1 Internal Communication
- [ ] Deployment scheduled and team notified
- [ ] Maintenance window communicated to users (if applicable)
- [ ] On-call engineer identified
- [ ] Rollback procedure reviewed with team
- [ ] Post-deployment validation assigned

### 10.2 Stakeholder Communication
- [ ] Deployment announcement drafted
- [ ] User notification prepared (if needed)
- [ ] Discord announcement ready
- [ ] Social media updates prepared (optional)

---

## 11. Rollback Planning

### 11.1 Rollback Preparation
- [ ] Previous version backup available
- [ ] Rollback script tested (`scripts/deployment/rollback-deployment.sh`)
- [ ] Database rollback plan documented
- [ ] Rollback decision criteria defined
- [ ] Rollback authorization process clear

### 11.2 Rollback Validation
- [ ] Rollback tested on staging environment
- [ ] Rollback time estimated (~3-5 minutes)
- [ ] Rollback notification templates prepared

---

## 12. Production Deployment

### 12.1 Pre-Deployment
- [ ] All checklist items above completed
- [ ] Deployment window confirmed
- [ ] Team on standby
- [ ] Monitoring dashboards open
- [ ] Communication channels ready

### 12.2 Deployment Execution
- [ ] Maintenance mode enabled (if applicable)
- [ ] Deployment script initiated
- [ ] Deployment logs monitored
- [ ] Errors addressed immediately
- [ ] Smoke tests executed
- [ ] Post-deployment validation completed

### 12.3 Post-Deployment
- [ ] Application responding correctly
- [ ] Critical features verified
- [ ] Performance metrics within acceptable range
- [ ] No critical errors in logs
- [ ] Monitoring confirms stability
- [ ] Team notified of successful deployment
- [ ] Users notified (if applicable)

---

## Sign-Off

### Deployment Approval

**Prepared by**: ________________
**Date**: ________________

**Technical Lead Approval**: ________________
**Date**: ________________

**Final Authorization**: ________________
**Date**: ________________

---

## Quick Reference Commands

```bash
# Pre-deployment validation
npm run verify:environment          # Verify all environment variables
npm audit                          # Check for vulnerabilities
npm run validate:schemas           # Validate database schema
npm run test:critical             # Run critical tests

# Deployment
cd /ixwiki/public/projects/ixstats
./scripts/deployment/deploy-to-staging.sh    # Deploy to staging
./scripts/deployment/deploy-to-production.sh # Deploy to production

# Post-deployment
npm run test:health               # Verify API health
npm run audit:urls:prod          # Verify production URLs

# Rollback (if needed)
./scripts/deployment/rollback-deployment.sh
```

---

## Notes

- Keep this checklist updated with each deployment
- Document any deviations from standard procedure
- Archive completed checklists for audit trail
- Review and improve checklist after each deployment

**Last Updated**: October 22, 2025
**Version**: 1.0
**Next Review**: After v1.2 deployment
