#!/bin/bash

# Production Deployment Script for IxStats
# Ensures the app is configured for https://ixwiki.com/projects/ixstats

set -e

echo "🚀 Starting production deployment for IxStats..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Set production environment
export NODE_ENV=production

# Load production environment variables
if [ -f ".env.production" ]; then
    echo "📄 Loading production environment variables..."
    export $(grep -v '^#' .env.production | xargs)
else
    echo "❌ Error: .env.production file not found"
    exit 1
fi

# Ensure base path variables are present before build/start so chunks map correctly.
normalize_base_path() {
    local value="$1"

    if [ -z "$value" ]; then
        echo ""
        return
    fi

    if [[ "$value" != /* ]]; then
        value="/$value"
    fi

    if [[ "$value" != "/" ]]; then
        value="${value%/}"
    fi

    echo "$value"
}

if [ -z "${BASE_PATH+x}" ]; then
    BASE_PATH="/projects/ixstats"
fi

BASE_PATH="$(normalize_base_path "$BASE_PATH")"

if [ -z "${NEXT_PUBLIC_BASE_PATH+x}" ]; then
    NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
fi

NEXT_PUBLIC_BASE_PATH="$(normalize_base_path "$NEXT_PUBLIC_BASE_PATH")"

export BASE_PATH NEXT_PUBLIC_BASE_PATH

# Check required environment variables
required_vars=("DATABASE_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    printf '   %s\n' "${missing_vars[@]}"
    echo "Please set these variables in .env.production before running the deployment script."
    exit 1
fi

# Check if Clerk is configured (optional)
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] && [ -n "$CLERK_SECRET_KEY" ]; then
    # Validate production keys (not test keys)
    if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" == pk_test_* ]]; then
        echo "❌ Error: Using test Clerk keys in production. Please update to production keys."
        exit 1
    fi
    
    if [[ "$CLERK_SECRET_KEY" == sk_test_* ]]; then
        echo "❌ Error: Using test Clerk secret in production. Please update to production keys."
        exit 1
    fi
    
    echo "✅ Clerk authentication configured"
else
    echo "ℹ️  Clerk authentication disabled (no keys provided)"
fi

# Validate database URL (allow SQLite for now)
if [[ "$DATABASE_URL" == file:* ]]; then
    echo "⚠️  Warning: Using SQLite database in production."
    echo "   Database file: $DATABASE_URL"
else
    echo "✅ Using external database: $DATABASE_URL"
fi

echo "✅ Environment variables validated"
echo "   BASE_PATH: $BASE_PATH"
echo "   NEXT_PUBLIC_BASE_PATH: $NEXT_PUBLIC_BASE_PATH"

# Clean previous build
echo "🧹 Cleaning previous build..."
npm run clean

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npm run db:generate

# Sync production database with schema
echo "🔄 Syncing production database schema..."
npm run db:sync

# Check if sync was successful
if [ $? -eq 0 ]; then
    echo "✅ Database sync completed successfully"
else
    echo "❌ Database sync failed"
    exit 1
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
else
    echo "❌ Build failed"
    exit 1
fi

# Display production configuration
echo ""
echo "🎯 Production Configuration:"
echo "   Base URL: https://ixwiki.com$BASE_PATH"
echo "   Node Environment: $NODE_ENV"
echo "   Database: Configured"
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] && [ -n "$CLERK_SECRET_KEY" ]; then
    echo "   Authentication: Clerk enabled"
else
    echo "   Authentication: Disabled"
fi
echo ""

# Start the production server
echo "🚀 Starting production server..."
echo "   The application will be available at: https://ixwiki.com$BASE_PATH"
echo "   Production server will run on port: $PORT"
echo "   Press Ctrl+C to stop the server"
echo ""

# Use simplified production start script
./start-production.sh 
