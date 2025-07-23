#!/bin/bash

# IxStats Server Configuration Validation Script
# Validates both development and production server configurations

set -e

echo "🔍 IxStats Server Configuration Validation"
echo "==========================================="
echo ""

# Function to check if a port is available
check_port() {
    local port=$1
    local env_name=$2
    
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo "   ❌ Port $port is in use ($env_name)"
        return 1
    else
        echo "   ✅ Port $port is available ($env_name)"
        return 0
    fi
}

# Function to validate environment file
validate_env_file() {
    local env_file=$1
    local env_name=$2
    
    echo "📄 Validating $env_name environment ($env_file):"
    
    if [ ! -f "$env_file" ]; then
        echo "   ❌ File not found: $env_file"
        return 1
    fi
    
    echo "   ✅ Environment file exists"
    
    # Source the environment file and check key variables
    local temp_env=$(mktemp)
    grep -v '^#' "$env_file" | grep '=' > "$temp_env" 2>/dev/null || true
    
    source "$temp_env" 2>/dev/null || true
    rm "$temp_env"
    
    if [ -n "$NODE_ENV" ]; then
        echo "   ✅ NODE_ENV: $NODE_ENV"
    else
        echo "   ❌ NODE_ENV not set"
    fi
    
    if [ -n "$PORT" ]; then
        echo "   ✅ PORT: $PORT"
        check_port "$PORT" "$env_name"
    else
        echo "   ❌ PORT not set"
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        echo "   ✅ DATABASE_URL: $DATABASE_URL"
    else
        echo "   ❌ DATABASE_URL not set"
    fi
    
    # Check authentication configuration
    if [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_test_ ]] && [[ "$CLERK_SECRET_KEY" =~ ^sk_test_ ]]; then
        echo "   ✅ Authentication: Clerk (Development)"
    elif [[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_live_ ]] && [[ "$CLERK_SECRET_KEY" =~ ^sk_live_ ]]; then
        echo "   ✅ Authentication: Clerk (Production)"
    elif [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] || [ -n "$CLERK_SECRET_KEY" ]; then
        echo "   ⚠️  Authentication: Clerk (Invalid key format)"
    else
        echo "   🎭 Authentication: Demo Mode (No Clerk keys)"
    fi
    
    echo ""
}

# Function to validate startup script
validate_startup_script() {
    local script_path=$1
    local script_name=$2
    
    echo "🚀 Validating $script_name startup script:"
    
    if [ ! -f "$script_path" ]; then
        echo "   ❌ Script not found: $script_path"
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo "   ❌ Script not executable: $script_path"
        echo "   Run: chmod +x $script_path"
        return 1
    fi
    
    echo "   ✅ Script exists and is executable"
    echo ""
}

# Navigate to project directory
PROJECT_DIR="/ixwiki/public/projects/ixstats"
cd "$PROJECT_DIR"

echo "🏠 Project Directory: $PROJECT_DIR"
echo ""

# Validate development environment
validate_env_file ".env.local" "Development"

# Reset environment variables
unset NODE_ENV PORT DATABASE_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY

# Validate production environment
validate_env_file ".env.production" "Production"

# Validate startup scripts
validate_startup_script "./start-development.sh" "Development"
validate_startup_script "./start-production.sh" "Production"

# Check package.json scripts
echo "📦 Validating package.json scripts:"
if grep -q '"dev": "./start-development.sh"' package.json; then
    echo "   ✅ npm run dev configured to use development script"
else
    echo "   ❌ npm run dev not properly configured"
fi

if grep -q '"start:prod": "./start-production.sh"' package.json; then
    echo "   ✅ npm run start:prod configured to use production script"
else
    echo "   ❌ npm run start:prod not properly configured"
fi

echo ""

# Summary
echo "📊 Configuration Summary:"
echo "   Development Server: localhost:3000 (root path)"
echo "   Production Server:  localhost:3550 (/projects/ixstats basePath)"
echo "   Database (Dev):     SQLite (./dev.db)"
echo "   Database (Prod):    SQLite (./prisma/prod.db)"
echo ""

echo "🎯 Ready to run:"
echo "   Development: npm run dev"
echo "   Production:  npm run start:prod"
echo ""

echo "✅ Server configuration validation complete!"