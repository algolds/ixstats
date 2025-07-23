# Clerk Dashboard Configuration for Production

## Overview
Your IxStats application runs at `https://ixwiki.com/projects/ixstats/` in production, so Clerk needs to be configured to handle this base path correctly.

## Required Clerk Dashboard Settings

### 1. Application Settings

**Location**: Clerk Dashboard → Your App → Settings → Paths

- **Application path**: `/projects/ixstats`
- **Root path**: `https://ixwiki.com`

### 2. Allowed Origins

**Location**: Clerk Dashboard → Your App → Settings → Allowed origins

Add these origins:
- `https://ixwiki.com`
- `https://ixwiki.com/projects/ixstats`
- `https://ixwiki.com/projects/ixstats/*`

### 3. Redirect URLs

**Location**: Clerk Dashboard → Your App → Settings → Paths

- **After sign-in URL**: `/projects/ixstats/dashboard`
- **After sign-up URL**: `/projects/ixstats/setup`
- **Home URL**: `/projects/ixstats`

### 4. Custom Sign-in/Sign-up Pages

**Location**: Clerk Dashboard → Your App → User & Authentication → Account Portal

Since you're using `https://accounts.ixwiki.com/`:
- **Sign-in URL**: `https://accounts.ixwiki.com/sign-in`
- **Sign-up URL**: `https://accounts.ixwiki.com/sign-up`

### 5. Webhook Endpoints (if used)

**Location**: Clerk Dashboard → Your App → Webhooks

If you have webhooks, update them to:
- `https://ixwiki.com/projects/ixstats/api/webhooks/clerk`

## Environment Variables

Ensure your `.env.production` has:

```bash
# Production Clerk Keys (already configured)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuaXh3aWtpLmNvbSQ
CLERK_SECRET_KEY=sk_live_kUBe5FHPW04tLmvILjy8ibD93dWKYCasQrvDlE3QVk
```

## Testing the Configuration

1. **Validate production keys**:
   ```bash
   npm run auth:validate:prod
   ```

2. **Build and start production server**:
   ```bash
   npm run build
   npm run start:prod
   ```

3. **Test authentication flow**:
   - Visit `https://ixwiki.com/projects/ixstats/profile`
   - Should redirect to `https://accounts.ixwiki.com/sign-in`
   - After sign-in, should redirect back to `/projects/ixstats/dashboard`

## Troubleshooting

### Issue: Redirects to wrong URL after sign-in
- **Cause**: Application path not set correctly in Clerk dashboard
- **Solution**: Set Application path to `/projects/ixstats`

### Issue: "Invalid redirect URL" error
- **Cause**: Missing allowed origins or redirect URLs
- **Solution**: Add all required URLs to allowed origins list

### Issue: Sign-in works but redirects to root instead of base path
- **Cause**: After sign-in URL not configured with base path
- **Solution**: Set after sign-in URL to `/projects/ixstats/dashboard`

## Verification Checklist

- [ ] Application path set to `/projects/ixstats`
- [ ] Allowed origins include `https://ixwiki.com/projects/ixstats`
- [ ] After sign-in URL is `/projects/ixstats/dashboard`
- [ ] After sign-up URL is `/projects/ixstats/setup`
- [ ] Custom sign-in/sign-up URLs point to `accounts.ixwiki.com`
- [ ] Production keys validated with `npm run auth:validate:prod`
- [ ] Test authentication flow works end-to-end