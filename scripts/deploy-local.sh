#!/bin/bash
# IxStates Local Deployment Wrapper
set -e

echo "🛡️ Running pre-deployment safety checks..."

echo "🧹 Running Prettier check..."
bun run format:check

echo "🔍 Running ESLint..."
bunx eslint src --cache

echo "🧪 Running unit tests..."
bun run test

echo "✅ All local safety checks passed!"
echo "🚀 Pushing current branch to GitHub..."
BRANCH=$(git branch --show-current)
git push origin "$BRANCH"

echo "🖥️ Triggering production deployment script on VPS..."
ssh ixwiki "cd /ixwiki/public/projects/ixstats && ./scripts/deploy-production.sh"

echo "🎉 Deployment initiated successfully!"
