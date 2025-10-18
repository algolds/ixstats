#!/bin/bash
# Parallel TypeScript type checking with timeout protection
# Splits the codebase into chunks to avoid timeout issues

set -e

TIMEOUT=90  # 90 seconds per chunk
FAILED=0

echo "🔍 Running parallel TypeScript type checking..."
echo ""

# Function to run typecheck with timeout
run_check() {
    local name=$1
    local config=$2

    echo "Checking $name..."
    if timeout $TIMEOUT npx tsc --project $config --noEmit 2>&1 | tee ".typecheck-$name.log"; then
        echo "✅ $name passed"
        rm -f ".typecheck-$name.log"
        return 0
    else
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            echo "⏱️  $name timed out after ${TIMEOUT}s"
        else
            echo "❌ $name failed"
            echo "   See .typecheck-$name.log for details"
        fi
        return 1
    fi
}

# Run checks in parallel
run_check "server" "tsconfig.server.json" &
PID_SERVER=$!

run_check "components" "tsconfig.components.json" &
PID_COMPONENTS=$!

run_check "app" "tsconfig.app.json" &
PID_APP=$!

# Wait for all checks and collect results
wait $PID_SERVER || FAILED=$((FAILED + 1))
wait $PID_COMPONENTS || FAILED=$((FAILED + 1))
wait $PID_APP || FAILED=$((FAILED + 1))

echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ All type checks passed!"
    exit 0
else
    echo "❌ $FAILED type check(s) failed"
    exit 1
fi
