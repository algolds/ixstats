#!/bin/bash

# Ensures BASE_PATH and NEXT_PUBLIC_BASE_PATH are set consistently for production builds/starts.
# Usage: ./scripts/with-base-path.sh <command> [args...]

set -e

DEFAULT_BASE_PATH="/projects/ixstats"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load production environment variables if we're running in production mode
if [ "${NODE_ENV:-}" = "production" ] && [ -f "$PROJECT_ROOT/.env.production" ]; then
    # shellcheck disable=SC1090
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a
fi

normalize_base_path() {
    local value="$1"

    # Empty string means no base path
    if [ -z "$value" ]; then
        echo ""
        return
    fi

    # Ensure leading slash
    if [[ "$value" != /* ]]; then
        value="/$value"
    fi

    # Remove trailing slash (except for root "/")
    if [[ "$value" != "/" ]]; then
        value="${value%/}"
    fi

    echo "$value"
}

# Only apply default if the variable is completely unset
if [ -z "${BASE_PATH+x}" ]; then
    BASE_PATH="$DEFAULT_BASE_PATH"
fi

BASE_PATH="$(normalize_base_path "$BASE_PATH")"

if [ -z "${NEXT_PUBLIC_BASE_PATH+x}" ]; then
    NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
fi

NEXT_PUBLIC_BASE_PATH="$(normalize_base_path "$NEXT_PUBLIC_BASE_PATH")"

export BASE_PATH NEXT_PUBLIC_BASE_PATH

exec "$@"
