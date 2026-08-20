#!/bin/bash

# Console.log Cleanup Script for IxStats
# This script removes debug console.log statements while preserving important logs

echo "Starting console.log cleanup..."

# Count initial console statements
INITIAL_COUNT=$(grep -r "console\.log" src --include="*.ts" --include="*.tsx" | wc -l)
echo "Initial console.log count: $INITIAL_COUNT"

# Categories of console.logs to KEEP (convert to proper logging later):
# - Error logging (console.error)
# - Warning logging (console.warn)
# - Critical auth/security warnings
# - Production environment warnings

# Remove common debug patterns
echo "Removing debug console.log statements..."

# Pattern 1: Flag loading debug statements
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Fetching flags for/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Completed:/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Refetching flag for/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Setting.*cached flags/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Batch loading/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Final flags for/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\].*Preloading/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Cache after preload:/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Current cache state:/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Intelligent preload completed/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[.*\] Starting intelligent preload/d' {} \;

# Pattern 2: WebSocket connection debug statements
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*Connecting to.*server/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*Connected to.*server/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*WebSocket connected/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*WebSocket disconnected/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*Reconnecting in/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*intelligence update:/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*Missing countryId or userId/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*Already connected/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(.*WebSocket: Retrying connection/d' {} \;

# Pattern 3: Notification debug statements
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27\[UnifiedNotifications\]/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27\[NotificationAPI\]/d' {} \;

# Pattern 4: Preview/initialization debug statements
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*".*Initializing IxStats Private Preview/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*".*Mock data system enabled/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*".*Preview environment initialized/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27.*Preview configuration cleared/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`Disabled feature:/d' {} \;

# Pattern 5: Data service initialization
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[DataService\] Initializing/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[DataService\] Countries initialized/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[DataService\].*countries have land area/d' {} \;

# Pattern 6: Performance monitoring
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27.*Page Performance:/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27Performance Observer not supported/d' {} \;

# Pattern 7: Cache operations
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27Cache cleared via performance dashboard/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`Country cache invalidated:/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27Performance statistics reset/d' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27Performance optimization triggered/d' {} \;

# Pattern 8: WebGL errors
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27WebGL context restored/d' {} \;

# Pattern 9: Premium/user setup
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*\x27\[usePremium\] User record created/d' {} \;

# Pattern 10: Middleware redirects (keep these as they're important, but commented for now)
# find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '/console\.log(\s*`\[Middleware\] Redirecting to:/d' {} \;

# Count final console statements
FINAL_COUNT=$(grep -r "console\.log" src --include="*.ts" --include="*.tsx" | wc -l)
REMOVED=$((INITIAL_COUNT - FINAL_COUNT))

echo "Cleanup complete!"
echo "Console.log statements removed: $REMOVED"
echo "Remaining console.log statements: $FINAL_COUNT"
echo ""
echo "Remaining statements are likely:"
echo "  - Auth/security warnings (keep)"
echo "  - Error context logging (convert to proper logger)"
echo "  - Critical environment checks (keep)"
