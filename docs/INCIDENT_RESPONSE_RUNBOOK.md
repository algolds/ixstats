# IxStats Security Incident Response Runbook

**Version**: 1.0
**Last Updated**: October 2025
**Document Owner**: Security Team

---

## Table of Contents

1. [Overview](#overview)
2. [Incident Classification](#incident-classification)
3. [Response Team](#response-team)
4. [Incident Response Procedures](#incident-response-procedures)
5. [Common Incident Scenarios](#common-incident-scenarios)
6. [Communication Protocols](#communication-protocols)
7. [Post-Incident Actions](#post-incident-actions)
8. [Tools and Resources](#tools-and-resources)

---

## Overview

This runbook provides step-by-step procedures for responding to security incidents in the IxStats platform. All security incidents should be handled swiftly and systematically to minimize impact.

### Objectives
- **Contain** the incident quickly
- **Investigate** root cause
- **Remediate** vulnerabilities
- **Recover** normal operations
- **Document** lessons learned

---

## Incident Classification

### Severity Levels

#### 🔴 **CRITICAL (P0)**
- **Response Time**: Immediate (< 15 minutes)
- **Examples**:
  - Active data breach in progress
  - Complete system compromise
  - Unauthorized access to production database
  - Mass user data exposure
  - Ransomware attack

#### 🟠 **HIGH (P1)**
- **Response Time**: < 1 hour
- **Examples**:
  - Unauthorized admin access
  - SQL injection exploit
  - Authentication bypass
  - Sensitive data leak
  - DDoS attack affecting availability

#### 🟡 **MEDIUM (P2)**
- **Response Time**: < 4 hours
- **Examples**:
  - Suspicious user activity
  - Failed intrusion attempts
  - Rate limit violations
  - XSS vulnerability discovered
  - Brute force attacks

#### 🟢 **LOW (P3)**
- **Response Time**: < 24 hours
- **Examples**:
  - Outdated dependencies with patches available
  - Security misconfigurations (non-exploited)
  - Social engineering attempts
  - Policy violations

---

## Response Team

### Roles and Responsibilities

| Role | Responsibilities | Contact |
|------|-----------------|---------|
| **Incident Commander** | Overall coordination, decision-making | [Phone/Email] |
| **Security Lead** | Technical investigation, containment | [Phone/Email] |
| **DevOps Lead** | Infrastructure, deployment, rollback | [Phone/Email] |
| **Communications Lead** | Stakeholder communication, PR | [Phone/Email] |
| **Legal Counsel** | Compliance, legal requirements | [Phone/Email] |

### Escalation Path
1. On-call engineer detects incident
2. Notify Security Lead
3. Security Lead assesses severity
4. If P0/P1: Immediately escalate to Incident Commander
5. Incident Commander assembles response team

---

## Incident Response Procedures

### Phase 1: Detection & Initial Response (0-15 minutes)

#### 1.1 Detect the Incident
**Monitoring Sources**:
- Discord webhook alerts
- Database audit logs (`SystemLog` table)
- Rate limiting violations
- User reports
- Automated security scans

#### 1.2 Create Incident Record
```bash
# Create incident tracking issue
gh issue create --title "SECURITY: [Brief description]" \
  --label "security,incident" \
  --body "Severity: [P0/P1/P2/P3]
Detected: [timestamp]
Detected by: [name]
Initial assessment: [description]"
```

#### 1.3 Assemble Response Team
- Page on-call team based on severity
- Start incident Slack/Discord channel: `#incident-YYYYMMDD-HHMMSS`
- Start incident timeline log

---

### Phase 2: Containment (15-60 minutes)

#### 2.1 Immediate Actions

**For Data Breach (P0)**:
```bash
# 1. Isolate affected systems
# 2. Revoke compromised credentials
npm run clerk:revoke-sessions --all-users

# 3. Enable emergency rate limiting
echo "RATE_LIMIT_MAX_REQUESTS=10" >> .env.production
pm2 restart ixstats

# 4. Block suspicious IPs (if identified)
# Add to firewall rules or Cloudflare

# 5. Snapshot current state for forensics
npm run db:backup
cp -r logs/ logs-incident-$(date +%Y%m%d-%H%M%S)/
```

**For Authentication Bypass (P1)**:
```bash
# 1. Force all users to re-authenticate
npm run auth:invalidate-all-sessions

# 2. Enable 2FA requirement temporarily
# Update Clerk settings via dashboard

# 3. Review audit logs
npm run logs:query --category=AUTH --since="2 hours ago"
```

**For DDoS Attack (P1)**:
```bash
# 1. Enable aggressive rate limiting
echo "RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_WINDOW_MS=60000" >> .env.production

# 2. Enable Cloudflare DDoS protection
# Or switch to "I'm Under Attack" mode

# 3. Scale infrastructure if needed
# Increase server capacity
```

#### 2.2 Evidence Preservation
```bash
# 1. Export relevant logs
npm run logs:export --since="24 hours ago" --output=incident-logs.json

# 2. Database snapshot
npm run db:snapshot --label="incident-$(date +%Y%m%d)"

# 3. Capture network traffic (if applicable)
# tcpdump or relevant tools

# 4. Screenshot dashboards/metrics
# Capture relevant monitoring data
```

---

### Phase 3: Investigation (1-4 hours)

#### 3.1 Root Cause Analysis

**Check SystemLog database**:
```sql
-- Recent critical errors
SELECT * FROM SystemLog
WHERE level = 'CRITICAL'
AND timestamp > datetime('now', '-24 hours')
ORDER BY timestamp DESC;

-- Suspicious user activity
SELECT userId, COUNT(*) as activity_count,
       MIN(timestamp) as first_seen, MAX(timestamp) as last_seen
FROM SystemLog
WHERE timestamp > datetime('now', '-24 hours')
GROUP BY userId
HAVING activity_count > 1000
ORDER BY activity_count DESC;

-- Failed authentication attempts
SELECT ip, COUNT(*) as attempts
FROM SystemLog
WHERE category = 'AUTH'
AND errorMessage IS NOT NULL
AND timestamp > datetime('now', '-1 hour')
GROUP BY ip
HAVING attempts > 10;
```

**Check Clerk audit logs**:
```bash
# Via Clerk Dashboard -> Audit Log
# Or API
curl https://api.clerk.com/v1/audit_logs \
  -H "Authorization: Bearer ${CLERK_SECRET_KEY}"
```

**Analyze tRPC audit logs**:
```bash
# Check AuditLog table
npm run audit:analyze --since="24 hours ago"
```

#### 3.2 Identify Affected Systems
- List of compromised accounts
- Affected data tables/records
- Exposed API endpoints
- Timeline of access

---

### Phase 4: Remediation (2-8 hours)

#### 4.1 Deploy Fixes

**Security Patch Deployment**:
```bash
# 1. Develop and test fix
git checkout -b hotfix/security-patch-$(date +%Y%m%d)

# 2. Apply fix
# ... make changes ...

# 3. Test in staging
npm run test
npm run typecheck
npm run build

# 4. Deploy to production
git tag -a security-patch-v$(date +%Y%m%d) -m "Security patch"
git push origin security-patch-v$(date +%Y%m%d)
npm run deploy:prod

# 5. Verify fix
npm run verify:production
```

#### 4.2 Credential Rotation
```bash
# 1. Generate new secrets
# Via Clerk Dashboard, generate new keys

# 2. Update environment variables
# Update .env.production with new keys

# 3. Rotate database credentials (if compromised)
# Update DATABASE_URL

# 4. Update webhook URLs (if needed)
# Generate new Discord webhook URLs

# 5. Restart services with new credentials
pm2 restart all
```

#### 4.3 User Notification (if required)
```typescript
// Use notification system
import { notificationService } from '~/lib/notifications';

await notificationService.sendToAllUsers({
  title: "Security Notice",
  message: "We have detected and resolved a security issue...",
  priority: "HIGH",
  category: "SECURITY"
});
```

---

### Phase 5: Recovery (4-24 hours)

#### 5.1 Restore Normal Operations
```bash
# 1. Verify all systems operational
npm run health:check

# 2. Monitor for 24-48 hours
# Watch logs, metrics, user activity

# 3. Gradually restore rate limits
# Return to normal thresholds
```

#### 5.2 Data Recovery (if needed)
```bash
# Restore from backup if data was corrupted
npm run db:restore --backup=incident-YYYYMMDD --confirm
```

---

### Phase 6: Post-Incident Review (24-72 hours)

#### 6.1 Incident Report Template

```markdown
# Security Incident Report: [Incident ID]

**Date**: [Date]
**Severity**: [P0/P1/P2/P3]
**Duration**: [Start] to [End] ([X] hours)
**Incident Commander**: [Name]

## Executive Summary
[Brief description of what happened]

## Timeline
| Time | Event | Action Taken |
|------|-------|--------------|
| [Time] | [Event] | [Action] |

## Impact Assessment
- **Users Affected**: [Number/Percentage]
- **Data Exposed**: [Type and quantity]
- **System Downtime**: [Duration]
- **Financial Impact**: [Estimate]

## Root Cause
[Detailed technical explanation]

## Response Actions
1. [Action taken]
2. [Action taken]
...

## What Went Well
- [Positive aspect]
- [Positive aspect]

## What Could Be Improved
- [Area for improvement]
- [Area for improvement]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action] | [Name] | [Date] | [ ] |

## Preventive Measures
1. [Measure to prevent recurrence]
2. [Measure to prevent recurrence]

## Lessons Learned
[Key takeaways]

**Report Prepared By**: [Name]
**Date**: [Date]
```

#### 6.2 Update Security Measures
- Apply lessons learned
- Update runbook with new procedures
- Implement additional monitoring
- Conduct team training

---

## Common Incident Scenarios

### Scenario 1: Compromised User Account

**Detection**:
- Unusual login locations
- Unexpected API calls
- Rate limit violations

**Response**:
1. Immediately lock the account
2. Review audit logs for all activity
3. Check for data accessed
4. Reset user credentials
5. Enable 2FA requirement
6. Notify user

**Commands**:
```bash
# Lock account
npm run user:suspend --userId="[user_id]" --reason="security"

# Review activity
npm run logs:user --userId="[user_id]" --since="7 days ago"

# Force password reset
npm run user:force-reset --userId="[user_id]"
```

### Scenario 2: SQL Injection Attempt

**Detection**:
- Unusual database queries in logs
- Error messages indicating SQL syntax
- Security scanner alerts

**Response**:
1. Identify the vulnerable endpoint
2. Review the code for SQL injection
3. Note: Prisma ORM should prevent this, but investigate
4. Check if any queries use raw SQL
5. Deploy fix immediately
6. Review all similar patterns

### Scenario 3: Rate Limit Abuse

**Detection**:
- High volume from single IP
- Rate limiter warnings in logs

**Response**:
1. Identify the source IP
2. Temporarily block if malicious
3. Increase rate limits if legitimate use
4. Monitor for continued abuse

**Commands**:
```bash
# Check rate limit violations
npm run logs:query --category=SECURITY --filter="rate_limit"

# Block IP temporarily (via firewall or Cloudflare)
```

### Scenario 4: Dependency Vulnerability

**Detection**:
- Dependabot alert
- npm audit warning
- Security scanner finding

**Response**:
1. Assess severity and exploitability
2. Check if dependency is actively used
3. Update to patched version
4. Test thoroughly
5. Deploy update

**Commands**:
```bash
# Check for vulnerabilities
npm audit

# Update specific package
npm update [package-name]

# Verify no regressions
npm test
npm run typecheck
```

---

## Communication Protocols

### Internal Communication

**Slack/Discord Channels**:
- `#incidents` - General incident coordination
- `#security-alerts` - Automated security alerts
- `#incident-[id]` - Specific incident channel

**Update Frequency**:
- P0: Every 15 minutes
- P1: Every 30 minutes
- P2/P3: Hourly during business hours

### External Communication

**User Notification**:
- **When**: If user data affected or extended downtime
- **How**: In-app notification + email
- **Template**:
```
Subject: Important Security Update - IxStats

Dear IxStats User,

We are writing to inform you about a security matter that may affect your account.

[Brief description of what happened]
[What data was affected]
[Actions we've taken]
[Actions you should take]

We take security very seriously and apologize for any concern this may cause.

If you have questions, please contact security@ixwiki.com

Best regards,
IxStats Security Team
```

---

## Tools and Resources

### Monitoring & Detection
- **Discord Webhooks**: Real-time alerts
- **SystemLog Database**: Comprehensive logging
- **Clerk Dashboard**: Authentication logs
- **npm audit**: Dependency vulnerabilities

### Investigation
- **Database**: Direct SQL queries on SystemLog
- **Prisma Studio**: GUI database browser
- **Application Logs**: Console and file logs

### Response & Recovery
- **Git**: Version control and rollback
- **PM2**: Process management
- **Backup System**: Database snapshots

### Documentation
- **[SECURITY_AUDIT_REPORT.md](../SECURITY_AUDIT_REPORT.md)**: Security posture
- **[SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md)**: Development guidelines
- **[PRODUCTION_READY.md](../PRODUCTION_READY.md)**: Deployment guide

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Incident Commander | [Name] | [Phone] | [Email] |
| Security Lead | [Name] | [Phone] | [Email] |
| DevOps Lead | [Name] | [Phone] | [Email] |
| Database Admin | [Name] | [Phone] | [Email] |

**24/7 On-Call**: [Phone/Pager]

---

## Appendix A: Useful Commands

```bash
# Check system health
npm run health:check

# Export logs
npm run logs:export --output=logs.json

# Database snapshot
npm run db:backup

# Force user logout
npm run auth:logout-all

# Check recent errors
npm run logs:errors --since="1 hour ago"

# Restart services
pm2 restart all

# View active connections
pm2 monit

# Check rate limiter status
npm run rate-limit:status
```

---

**Document Version**: 1.0
**Last Review**: October 2025
**Next Review**: January 2026
**Document Owner**: Security Team

*This is a living document. Update after each incident with lessons learned.*
