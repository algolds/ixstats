#!/bin/bash

# Find an available port starting from 3000
find_port() {
    local port=3000
    while [ $port -le 9999 ]; do
        if ! netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    echo "No available ports found" >&2
    return 1
}

# Find available port
AVAILABLE_PORT=$(find_port)

if [ $? -eq 0 ]; then
    echo "Starting server on port $AVAILABLE_PORT"
    exec next start -p $AVAILABLE_PORT
else
    echo "Failed to find available port"
    exit 1
fi 