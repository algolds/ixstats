#!/bin/bash

# Redis Setup Script for Vector Tile Caching
# Sets up Redis container for Phase 2 tile caching

REDIS_CONTAINER="ixstats-redis-cache"
REDIS_PORT=6379
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

case "$1" in
  start)
    # Check if container already exists
    if docker ps -a -f "name=$REDIS_CONTAINER" --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
      # Container exists, check if it's running
      if docker ps -f "name=$REDIS_CONTAINER" --format "{{.Names}}" | grep -q "^${REDIS_CONTAINER}$"; then
        echo "Redis container is already running on port $REDIS_PORT"
        exit 0
      else
        # Container exists but not running, start it
        echo "Starting existing Redis container..."
        docker start "$REDIS_CONTAINER" > /dev/null
        echo "✓ Redis started on port $REDIS_PORT"
        exit 0
      fi
    fi

    # Container doesn't exist, create and start it
    echo "Creating Redis container for tile caching..."
    if [ -n "$REDIS_PASSWORD" ]; then
      docker run -d \
        --name "$REDIS_CONTAINER" \
        -p "$REDIS_PORT:6379" \
        -v ixstats-redis-data:/data \
        redis:7-alpine \
        redis-server --requirepass "$REDIS_PASSWORD" --maxmemory 2gb --maxmemory-policy allkeys-lru > /dev/null
    else
      docker run -d \
        --name "$REDIS_CONTAINER" \
        -p "$REDIS_PORT:6379" \
        -v ixstats-redis-data:/data \
        redis:7-alpine \
        redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru > /dev/null
    fi
    echo "✓ Redis started on port $REDIS_PORT"
    echo "  - Max Memory: 2GB"
    echo "  - Eviction Policy: allkeys-lru (least recently used)"
    ;;

  stop)
    echo "Stopping Redis container..."
    docker stop "$REDIS_CONTAINER"
    echo "✓ Redis stopped"
    ;;

  restart)
    echo "Restarting Redis container..."
    docker restart "$REDIS_CONTAINER"
    echo "✓ Redis restarted"
    ;;

  status)
    echo "Redis container status:"
    docker ps -f "name=$REDIS_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Testing Redis connection..."
    if [ -n "$REDIS_PASSWORD" ]; then
      docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" ping
    else
      docker exec "$REDIS_CONTAINER" redis-cli ping
    fi
    ;;

  stats)
    echo "Redis statistics:"
    if [ -n "$REDIS_PASSWORD" ]; then
      docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" INFO stats | grep -E "total_commands_processed|instantaneous_ops_per_sec|keyspace_hits|keyspace_misses"
      echo ""
      echo "Memory usage:"
      docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" INFO memory | grep -E "used_memory_human|maxmemory_human"
      echo ""
      echo "Total keys:"
      docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" DBSIZE
    else
      docker exec "$REDIS_CONTAINER" redis-cli INFO stats | grep -E "total_commands_processed|instantaneous_ops_per_sec|keyspace_hits|keyspace_misses"
      echo ""
      echo "Memory usage:"
      docker exec "$REDIS_CONTAINER" redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human"
      echo ""
      echo "Total keys:"
      docker exec "$REDIS_CONTAINER" redis-cli DBSIZE
    fi
    ;;

  flush)
    echo "WARNING: This will delete ALL cached tiles!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      echo "Flushing Redis cache..."
      if [ -n "$REDIS_PASSWORD" ]; then
        docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" FLUSHALL
      else
        docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL
      fi
      echo "✓ Cache flushed"
    else
      echo "Cancelled"
    fi
    ;;

  clean)
    echo "Removing Redis container and volume..."
    docker stop "$REDIS_CONTAINER" 2>/dev/null
    docker rm "$REDIS_CONTAINER" 2>/dev/null
    docker volume rm ixstats-redis-data 2>/dev/null
    echo "✓ Redis container and volume removed"
    ;;

  *)
    echo "Redis Setup Script for Vector Tile Caching"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|stats|flush|clean}"
    echo ""
    echo "Commands:"
    echo "  start    - Start Redis container (2GB max memory, LRU eviction)"
    echo "  stop     - Stop Redis container"
    echo "  restart  - Restart Redis container"
    echo "  status   - Check Redis status and test connection"
    echo "  stats    - Show Redis statistics (commands, memory, keys)"
    echo "  flush    - Delete all cached tiles (requires confirmation)"
    echo "  clean    - Stop and remove Redis container and volume"
    echo ""
    echo "Environment Variables:"
    echo "  REDIS_PASSWORD - Optional password for Redis authentication"
    exit 1
    ;;
esac
