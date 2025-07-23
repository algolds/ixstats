# Authentication Setup Guide

This guide explains how to configure Clerk authentication for different environments in IxStats.

## Environment Configuration

### Development Environment (`npm run dev`)

For development, use **test keys** from Clerk:

1. **Create a Clerk Account** (if you don't have one):
   - Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
   - Create a new application or use an existing one

2. **Get Development Keys**:
   - In your Clerk dashboard, go to **API Keys**
   - Copy the **Test** keys (they start with `pk_test_` and `sk_test_`)

3. **Configure `.env.local`**:
   ```bash
   # Clerk Authentication (Development - using test keys)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here
   CLERK_SECRET_KEY=sk_test_your_test_secret_key_here
   ```

4. **Restart the development server**:
   ```bash
   npm run dev
   ```

### Production Environment

For production, use **live keys** from Clerk:

1. **Get Production Keys**:
   - In your Clerk dashboard, go to **API Keys**
   - Copy the **Live** keys (they start with `pk_live_` and `sk_live_`)

2. **Configure `.env.production`**:
   ```bash
   # Clerk Authentication (Production - using live keys)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_live_publishable_key_here
   CLERK_SECRET_KEY=sk_live_your_live_secret_key_here
   ```

3. **Build and start production**:
   ```bash
   npm run build
   npm run start:prod
   ```

## Environment Detection

The application automatically detects the environment and shows warnings:

- ⚠️ **Development + Live Keys**: Console warning to switch to test keys
- ⚠️ **Production + Test Keys**: Console warning to switch to live keys
- ✅ **Development + Test Keys**: Correct configuration
- ✅ **Production + Live Keys**: Correct configuration

## Authentication States

### When Clerk is Configured
- Full authentication functionality
- Users can sign in/out
- Protected routes work as expected
- User profiles and data are available

### When Clerk is NOT Configured
- Fallback to demo mode
- Sign-in button shows helpful configuration message
- Application functions without authentication
- All routes are accessible

## Quick Setup Commands

### Development Setup

#### Option 1: Quick Setup (Recommended)
```bash
# Interactive setup helper
npm run clerk:setup

# Then restart development server
npm run dev
```

#### Option 2: Manual Setup
```bash
# 1. Copy your test keys to .env.local
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here" >> .env.local
echo "CLERK_SECRET_KEY=sk_test_your_key_here" >> .env.local

# 2. Restart development server
npm run dev
```

#### Option 3: Demo Mode (No Authentication)
```bash
# Comment out Clerk keys in .env.local to run in demo mode
# The app will work without authentication
npm run dev
```

### Production Setup
```bash
# 1. Ensure live keys are in .env.production
# 2. Build and deploy
npm run build
npm run start:prod
```

## Troubleshooting

### "Authentication is not configured" Message
- Check that your keys are set in the correct environment file
- Ensure keys start with `pk_test_`/`sk_test_` (dev) or `pk_live_`/`sk_live_` (prod)
- Restart the server after adding keys

### Console Warnings About Key Types
- Development should use `pk_test_` and `sk_test_` keys
- Production should use `pk_live_` and `sk_live_` keys
- Switch to the correct key type for your environment

### Still Having Issues?
1. Check the browser console for specific error messages
2. Verify your Clerk dashboard settings
3. Ensure environment variables are loaded correctly
4. Try clearing browser cache and cookies

## Security Notes

- **Never commit** real Clerk keys to version control
- Keep test and live keys separate
- Rotate keys if they're accidentally exposed
- Use environment-specific configuration files