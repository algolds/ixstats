#!/bin/bash
# Post-build script for Next.js standalone output
# Copies static assets and public files to the standalone directory

set -e

echo "📦 Running post-build script for standalone deployment..."

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Check if standalone build exists
if [ ! -d ".next/standalone" ]; then
    echo "❌ Error: Standalone build not found. Did the build complete successfully?"
    exit 1
fi

echo "📁 Copying static files to standalone directory..."
if [ -d ".next/static" ]; then
    cp -r .next/static .next/standalone/.next/static
    echo "✅ Static files copied"
else
    echo "⚠️  Warning: .next/static directory not found"
fi

echo "📁 Copying public directory to standalone directory..."
if [ -d "public" ]; then
    cp -r public .next/standalone/
    echo "✅ Public files copied"
else
    echo "⚠️  Warning: public directory not found"
fi

echo "✅ Post-build script completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Restart the PM2 process: pm2 restart ixstats"
echo "  2. Or run the production start script: ./start-production.sh"

