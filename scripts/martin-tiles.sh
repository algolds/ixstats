#!/bin/bash

# Martin Tile Server Management Script
# Quick commands for managing Martin tile server

MARTIN_CONTAINER="martin-tiles"
MARTIN_CONFIG="/ixwiki/public/projects/ixstats/martin-config.yaml"
MARTIN_PORT=3800

case "$1" in
  start)
    # Check if container already exists
    if docker ps -a -f "name=$MARTIN_CONTAINER" --format "{{.Names}}" | grep -q "^${MARTIN_CONTAINER}$"; then
      # Container exists, check if it's running
      if docker ps -f "name=$MARTIN_CONTAINER" --format "{{.Names}}" | grep -q "^${MARTIN_CONTAINER}$"; then
        echo "Martin tile server is already running on port $MARTIN_PORT"
        exit 0
      else
        # Container exists but not running, start it
        echo "Starting existing Martin container..."
        docker start "$MARTIN_CONTAINER" > /dev/null
        echo "Martin started on port $MARTIN_PORT"
        exit 0
      fi
    fi

    # Container doesn't exist, create and start it
    echo "Creating Martin tile server container..."
    docker run -d \
      --name "$MARTIN_CONTAINER" \
      --network host \
      -v "$MARTIN_CONFIG:/config.yaml" \
      ghcr.io/maplibre/martin:latest \
      --config /config.yaml > /dev/null
    echo "Martin started on port $MARTIN_PORT"
    ;;

  stop)
    echo "Stopping Martin tile server..."
    docker stop "$MARTIN_CONTAINER"
    echo "Martin stopped"
    ;;

  restart)
    echo "Restarting Martin tile server..."
    docker restart "$MARTIN_CONTAINER"
    echo "Martin restarted"
    ;;

  logs)
    echo "Showing Martin logs (Ctrl+C to exit)..."
    docker logs -f "$MARTIN_CONTAINER"
    ;;

  status)
    echo "Martin container status:"
    docker ps -f "name=$MARTIN_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Testing Martin endpoint..."
    if curl -f -s http://localhost:$MARTIN_PORT/catalog > /dev/null; then
      echo "✓ Martin is responding on port $MARTIN_PORT"
    else
      echo "✗ Martin is not responding"
    fi
    ;;

  test)
    echo "Testing Martin tile performance..."
    echo ""
    echo "Catalog endpoint:"
    curl -s http://localhost:$MARTIN_PORT/catalog | jq '.tiles | keys'
    echo ""
    echo "Testing tile request (political layer, zoom 4, tile 8,5):"
    time curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s, Size: %{size_download} bytes\n" \
      "http://localhost:$MARTIN_PORT/map_layer_political/4/8/5"
    echo ""
    echo "Testing cached tile performance (3 more requests):"
    for i in 1 2 3; do
      curl -s -o /dev/null -w "Request $i: %{time_total}s\n" \
        "http://localhost:$MARTIN_PORT/map_layer_political/4/8/5"
    done
    ;;

  clean)
    echo "Removing Martin container..."
    docker stop "$MARTIN_CONTAINER" 2>/dev/null
    docker rm "$MARTIN_CONTAINER" 2>/dev/null
    echo "Martin container removed"
    ;;

  pull)
    echo "Pulling latest Martin image..."
    docker pull ghcr.io/maplibre/martin:latest
    echo "Martin image updated"
    ;;

  *)
    echo "Martin Tile Server Management Script"
    echo ""
    echo "Usage: $0 {start|stop|restart|logs|status|test|clean|pull}"
    echo ""
    echo "Commands:"
    echo "  start    - Start Martin tile server"
    echo "  stop     - Stop Martin tile server"
    echo "  restart  - Restart Martin tile server"
    echo "  logs     - Show Martin logs (live)"
    echo "  status   - Check Martin status and test endpoint"
    echo "  test     - Test tile performance"
    echo "  clean    - Stop and remove Martin container"
    echo "  pull     - Pull latest Martin image"
    exit 1
    ;;
esac
