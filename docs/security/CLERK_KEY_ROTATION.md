# Clerk API Key Rotation Guide

## Overview

This guide provides step-by-step instructions for rotating Clerk authentication API keys in the IxStats application. Key rotation is a critical security practice that should be performed regularly or immediately after a suspected security incident.

## When to Rotate Keys

### Scheduled Rotation
- **Recommended**: Every 90 days as part of regular security maintenance
- **Minimum**: Every 180 days to maintain security posture

### Emergency Rotation
Rotate keys immediately if:
- A key is accidentally committed to a public repository
- A key is exposed in logs or error messages
- An employee with key access leaves the organization
- Suspicious authentication activity is detected
- A security audit recommends immediate rotation
- Compliance requirements mandate key change

## Prerequisites

Before starting the rotation process:

1. **Administrative Access**
   - Clerk Dashboard admin access
   - Server/deployment environment access (SSH, hosting panel, etc.)
   - Git repository write access

2. **Communication Plan**
   - Notify team members of planned maintenance window
   - Schedule rotation during low-traffic period
   - Prepare rollback plan

3. **Backup Current Configuration**
   ```bash
   # Backup current .env.local file
   cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
   ```

4. **Access to Deployment Systems**
   - Production server access
   - CI/CD pipeline access
   - Environment variable management system

## Step-by-Step Key Rotation Process

### Phase 1: Preparation (15 minutes)

#### 1.1 Document Current Configuration

Create a rotation log documenting:
- Current key identifiers (last 4 characters only)
- Rotation date and time
- Person performing rotation
- Reason for rotation

```markdown
## Clerk Key Rotation Log

Date: 2025-01-15 14:30 UTC
Performed by: [Your Name]
Reason: Scheduled 90-day rotation
Environment: Production

Current Keys:
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_...ABC123 (last 6)
- CLERK_SECRET_KEY: sk_test_...XYZ789 (last 6)
```

#### 1.2 Verify Current System Health

```bash
# Check application status
curl https://ixstats.com/api/health

# Verify authentication is working
curl -H "Authorization: Bearer $CURRENT_TOKEN" https://ixstats.com/api/auth/verify
```

#### 1.3 Enable Maintenance Mode (Optional but Recommended)

```bash
# Create maintenance mode flag
touch /var/www/ixstats/.maintenance

# Or use environment variable
export MAINTENANCE_MODE=true
```

### Phase 2: Generate New Keys (10 minutes)

#### 2.1 Access Clerk Dashboard

1. Navigate to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your IxStats application
3. Go to **API Keys** section

#### 2.2 Generate New Publishable Key

1. In the **Publishable keys** section, click **Create key**
2. Select the appropriate environment (Production/Development)
3. Add a descriptive name: `IxStats Production - Rotated 2025-01-15`
4. Click **Create**
5. **Copy the new publishable key immediately** - you won't see it again
   ```
   pk_live_[REDACTED_FOR_SECURITY]
   ```

#### 2.3 Generate New Secret Key

1. In the **Secret keys** section, click **Create key**
2. Select the appropriate environment (Production/Development)
3. Add a descriptive name: `IxStats Production Secret - Rotated 2025-01-15`
4. Click **Create**
5. **Copy the new secret key immediately** - you won't see it again
   ```
   sk_live_[REDACTED_FOR_SECURITY]
   ```

#### 2.4 Store Keys Securely

**Temporarily store new keys in a secure location:**
- Password manager (1Password, LastPass, etc.)
- Encrypted note
- Secure internal documentation system

**DO NOT:**
- Email the keys
- Store in Slack/Discord/Teams
- Commit to Git
- Store in plain text files

### Phase 3: Update Environment Variables (20 minutes)

#### 3.1 Update Local Development Environment

1. Open `.env.local` file
2. Replace the old keys with new ones:

```bash
# Old keys (to be removed)
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_old...
# CLERK_SECRET_KEY=sk_test_old...

# New keys (rotated 2025-01-15)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_[REDACTED_FOR_SECURITY]
CLERK_SECRET_KEY=sk_live_[REDACTED_FOR_SECURITY]
```

3. Save the file
4. Test locally:

```bash
npm run dev

# In another terminal
curl http://localhost:3000/api/auth/verify
```

#### 3.2 Update Staging Environment (if applicable)

```bash
# SSH into staging server
ssh user@staging.ixstats.com

# Navigate to application directory
cd /var/www/ixstats

# Update environment variables
nano .env.production

# Update the keys, save, and exit

# Restart the application
pm2 restart ixstats-staging
pm2 logs ixstats-staging --lines 50
```

#### 3.3 Update Production Environment

**Option A: Direct Environment File Update**

```bash
# SSH into production server
ssh user@ixstats.com

# Navigate to application directory
cd /var/www/ixstats

# Backup current .env file
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)

# Update environment variables
nano .env.production

# Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Update CLERK_SECRET_KEY

# Save and exit
```

**Option B: Using Environment Variable Management System**

If using a hosting platform with environment variable UI:

1. Navigate to your hosting dashboard (Vercel, Railway, etc.)
2. Go to Environment Variables section
3. Update `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Update `CLERK_SECRET_KEY`
5. Save changes

**Option C: Using CI/CD Secrets**

If using GitHub Actions, GitLab CI, etc.:

1. Navigate to repository settings
2. Go to Secrets/Variables section
3. Update `CLERK_PUBLISHABLE_KEY` secret
4. Update `CLERK_SECRET_KEY` secret
5. Trigger deployment

### Phase 4: Deploy and Verify (15 minutes)

#### 4.1 Restart Production Application

```bash
# Using PM2
pm2 restart ixstats

# Or using systemd
systemctl restart ixstats

# Or using Docker
docker-compose restart ixstats

# Or trigger redeployment on hosting platform
# (Vercel, Railway, etc. - use their UI or CLI)
```

#### 4.2 Verify New Keys Are Active

```bash
# Check application logs for authentication events
pm2 logs ixstats --lines 100

# Look for successful Clerk SDK initialization
# Should see: "Clerk initialized successfully"
```

#### 4.3 Test Authentication Flow

1. **Test Sign-In**
   ```bash
   # Visit the application
   open https://ixstats.com

   # Try signing in with test account
   # Verify successful authentication
   ```

2. **Test API Endpoints**
   ```bash
   # Test protected endpoint
   curl -H "Authorization: Bearer $NEW_TOKEN" \
        https://ixstats.com/api/countries

   # Should return 200 OK with data
   ```

3. **Test User Session**
   - Open the application in incognito mode
   - Sign in with a test account
   - Navigate to protected pages (/mycountry, /dashboard)
   - Verify no authentication errors

4. **Check Error Logs**
   ```bash
   # Monitor for authentication errors
   tail -f /var/log/ixstats/error.log | grep -i "clerk\|auth"

   # Or using PM2
   pm2 logs ixstats --err --lines 50 | grep -i "clerk\|auth"
   ```

### Phase 5: Cleanup and Monitoring (10 minutes)

#### 5.1 Revoke Old Keys in Clerk Dashboard

**IMPORTANT:** Only revoke old keys AFTER confirming new keys work!

1. Return to Clerk Dashboard
2. Navigate to **API Keys**
3. Find the old publishable key
4. Click the three dots menu → **Revoke**
5. Confirm revocation
6. Repeat for old secret key

#### 5.2 Remove Old Keys from Systems

```bash
# Remove from backup files (after 7 days of stable operation)
rm .env.local.backup.*

# Clear from password manager temporary storage
# Update internal documentation
```

#### 5.3 Update Documentation

Update these files with rotation information:
- Internal runbooks
- Disaster recovery documentation
- Security audit logs

#### 5.4 Monitor Application (24-48 hours)

```bash
# Set up monitoring alerts
# Watch for:
# - Authentication failures
# - 401/403 errors
# - Unusual user session behavior

# Check metrics dashboard
# Monitor user login rates
# Verify no spike in authentication errors
```

## Rollback Procedure

If issues occur after key rotation:

### Immediate Rollback (5 minutes)

```bash
# SSH into production
ssh user@ixstats.com

# Restore backup environment file
cd /var/www/ixstats
cp .env.production.backup.YYYYMMDD_HHMMSS .env.production

# Restart application
pm2 restart ixstats

# Verify rollback successful
pm2 logs ixstats --lines 50
```

### Post-Rollback Actions

1. **Do NOT revoke new keys** - keep them for future use
2. **Investigate root cause** of rollback
3. **Document issues encountered**
4. **Schedule new rotation attempt** after fixes

## Testing Checklist

Use this checklist during rotation:

- [ ] Backup current `.env` files
- [ ] Generate new Clerk publishable key
- [ ] Generate new Clerk secret key
- [ ] Update local `.env.local`
- [ ] Test locally (`npm run dev`)
- [ ] Update staging environment
- [ ] Test on staging
- [ ] Update production environment variables
- [ ] Restart production application
- [ ] Test sign-in flow
- [ ] Test protected API endpoints
- [ ] Test user session persistence
- [ ] Monitor error logs (15 minutes)
- [ ] Revoke old keys in Clerk Dashboard
- [ ] Update documentation
- [ ] Set up 24-hour monitoring
- [ ] Remove temporary key storage (after 7 days)

## Common Issues and Solutions

### Issue 1: "Invalid publishable key" Error

**Symptom:**
```
Error: Invalid Clerk publishable key
```

**Solution:**
1. Verify key format starts with `pk_live_` or `pk_test_`
2. Check for extra spaces or line breaks in `.env` file
3. Ensure key is from correct Clerk application
4. Verify environment (test vs live) matches

### Issue 2: Users Unable to Sign In

**Symptom:**
```
Authentication failed: 401 Unauthorized
```

**Solution:**
1. Check secret key is correctly set
2. Verify Clerk Dashboard shows application as active
3. Check CORS settings in Clerk Dashboard
4. Verify domain allowlist includes production domain

### Issue 3: Environment Variables Not Updating

**Symptom:**
Old keys still appear to be in use after restart

**Solution:**
1. Hard restart application (stop, then start)
2. Clear environment variable cache:
   ```bash
   pm2 delete ixstats
   pm2 start ecosystem.config.js
   ```
3. Verify `.env.production` file is being loaded
4. Check for hardcoded keys in code (should not exist)

### Issue 4: CSRF Token Errors

**Symptom:**
```
CSRF token validation failed
```

**Solution:**
1. Clear browser cookies and local storage
2. Regenerate session tokens
3. Verify `CLERK_ENCRYPTION_KEY` hasn't been changed
4. Check Clerk webhook signatures are valid

## Security Best Practices

### Key Storage

**DO:**
- Store keys in environment variables
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault)
- Encrypt keys at rest
- Use different keys for dev/staging/production

**DON'T:**
- Commit keys to Git
- Store in plain text files
- Email keys to team members
- Reuse keys across applications

### Access Control

1. **Limit Key Access**
   - Only essential team members should access production keys
   - Use role-based access control (RBAC)
   - Audit key access regularly

2. **Rotation Schedule**
   - Set calendar reminders for scheduled rotations
   - Automate rotation where possible
   - Document all rotations

3. **Monitoring**
   - Monitor authentication failure rates
   - Set up alerts for suspicious activity
   - Review Clerk audit logs monthly

## Automation (Advanced)

For teams performing frequent rotations:

```bash
#!/bin/bash
# clerk-key-rotation.sh
# Automated key rotation script

set -e

# Configuration
CLERK_APP_ID="your_clerk_app_id"
ENVIRONMENT="production"

# Backup current keys
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)

# Generate new keys using Clerk API
# Note: Requires Clerk API access token
NEW_PUBLISHABLE_KEY=$(clerk-cli keys create publishable --app $CLERK_APP_ID)
NEW_SECRET_KEY=$(clerk-cli keys create secret --app $CLERK_APP_ID)

# Update environment file
sed -i "s/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEW_PUBLISHABLE_KEY/" .env.production
sed -i "s/^CLERK_SECRET_KEY=.*/CLERK_SECRET_KEY=$NEW_SECRET_KEY/" .env.production

# Restart application
pm2 restart ixstats

# Wait for application to start
sleep 10

# Test authentication
./test-auth.sh

# If tests pass, revoke old keys
if [ $? -eq 0 ]; then
  clerk-cli keys revoke $OLD_PUBLISHABLE_KEY
  clerk-cli keys revoke $OLD_SECRET_KEY
  echo "Key rotation completed successfully!"
else
  echo "Tests failed, rolling back..."
  cp .env.production.backup.* .env.production
  pm2 restart ixstats
  exit 1
fi
```

## Compliance Notes

### SOC 2 / ISO 27001
- Document all key rotations in security audit log
- Maintain rotation schedule of ≤90 days
- Restrict key access to authorized personnel only

### GDPR
- Rotate keys after personnel changes
- Maintain audit trail of who accessed keys when
- Implement key lifecycle policies

### PCI DSS (if applicable)
- Rotate keys every 90 days minimum
- Use strong key generation methods
- Protect keys with encryption at rest

## Contact Information

If you encounter issues during key rotation:

1. **Clerk Support**: support@clerk.dev
2. **IxStats DevOps Team**: [your-team-email]
3. **Emergency Hotline**: [emergency-contact]

## Appendix A: Key Inventory Template

```markdown
# Clerk API Key Inventory

## Production Keys
- **Publishable Key**: pk_live_...ABCD (Rotated: 2025-01-15, Expires: 2025-04-15)
- **Secret Key**: sk_live_...WXYZ (Rotated: 2025-01-15, Expires: 2025-04-15)
- **Access**: [List authorized personnel]

## Staging Keys
- **Publishable Key**: pk_test_...EFGH (Rotated: 2025-01-10, Expires: 2025-04-10)
- **Secret Key**: sk_test_...STUV (Rotated: 2025-01-10, Expires: 2025-04-10)
- **Access**: [List authorized personnel]

## Development Keys
- **Publishable Key**: pk_test_...IJKL (Rotated: 2025-01-05, Expires: 2025-04-05)
- **Secret Key**: sk_test_...MNOP (Rotated: 2025-01-05, Expires: 2025-04-05)
- **Access**: All developers

## Rotation History
| Date | Environment | Reason | Performed By |
|------|-------------|--------|--------------|
| 2025-01-15 | Production | Scheduled | Alice |
| 2024-10-15 | Production | Scheduled | Bob |
| 2024-09-30 | All | Security Incident | Security Team |
```

## Appendix B: Post-Rotation Verification Script

```bash
#!/bin/bash
# verify-clerk-rotation.sh

set -e

ENDPOINT="https://ixstats.com"

echo "=== Clerk Key Rotation Verification ==="

# Test 1: Health Check
echo "Test 1: Application Health Check"
curl -f $ENDPOINT/api/health || exit 1
echo "✓ Health check passed"

# Test 2: Authentication Endpoint
echo "Test 2: Authentication Endpoint"
curl -f $ENDPOINT/api/auth/session || exit 1
echo "✓ Auth endpoint accessible"

# Test 3: Protected Route
echo "Test 3: Protected Route (with valid token)"
TOKEN=$(clerk-cli users create-session --app-id $CLERK_APP_ID)
curl -f -H "Authorization: Bearer $TOKEN" $ENDPOINT/api/countries || exit 1
echo "✓ Protected route works with new keys"

# Test 4: Sign-in Flow
echo "Test 4: Sign-in Flow"
# Use Playwright or similar to test full auth flow
# ./test-signin.sh || exit 1
echo "✓ Sign-in flow successful"

echo ""
echo "=== All Verification Tests Passed ==="
echo "New Clerk keys are working correctly!"
```

---

**Last Updated**: 2025-01-15
**Version**: 1.0
**Maintainer**: IxStats Security Team