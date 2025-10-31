# Maps Monitoring Dashboard - User Guide

## Overview

The Maps Monitoring Dashboard provides real-time insights into the IxStats maps system, including Redis cache statistics, Martin tile server status, and performance metrics.

**Access:** Admin Panel → Maps Monitoring
**URL:** `/admin/maps-monitoring`
**Permission:** Admin only

---

## Features

### 1. Service Status Overview

View the health status of all map-related services at a glance:

- **Redis Cache**: Tile caching service (critical for performance)
- **Martin Tile Server**: Vector tile generation service
- **PostGIS Database**: Geographic database with map layers

Each service shows:
- ✅ **Running** and **Healthy** - Service is operational
- ⚠️ **Running** but **Unhealthy** - Service needs attention
- ❌ **Stopped** - Service is not running

---

### 2. Redis Cache Statistics

Monitor your tile caching performance:

#### Key Metrics

**Total Cached Tiles**
- Number of vector tiles stored in Redis
- Typical range: 10,000 - 100,000 tiles
- Target: >13,000 tiles (zoom 0-8 pregenerated)

**Cache Hit Rate**
- Percentage of tile requests served from cache vs database
- Target: **85-95%** (excellent)
- 60-84%: Good
- <60%: Needs optimization

**Memory Usage**
- Current Redis memory consumption
- Max configured: 2GB
- Target: <80% for headroom

**Uptime**
- How long Redis has been running
- Evicted keys: Number of tiles removed due to memory pressure

#### Actions

**Clear Cache Button**
- Removes all cached tiles
- Use when: Data has changed and tiles need regeneration
- Warning: Will cause temporary performance degradation

---

### 3. Martin Tile Server

Monitor the vector tile generation service:

**Status Indicators**
- **Running**: Service is active and responding
- **Healthy**: Passes health checks
- **Endpoint**: Connection URL (usually http://localhost:3800)

**Available Layers**
Display of all tile layers being served:
- `map_layer_political` - Country boundaries
- `map_layer_climate` - Climate zones
- `map_layer_rivers` - Rivers
- `map_layer_lakes` - Lakes
- `map_layer_icecaps` - Polar ice caps
- `map_layer_altitudes` - Terrain/elevation
- And more...

**Troubleshooting**
- If "Unhealthy": Container health check misconfigured (service may still work)
- If "Stopped": Run `./scripts/martin-tiles.sh start`
- If "Error": Check Docker logs with `docker logs martin-tiles`

---

### 4. Tile Performance Metrics

Track tile delivery performance:

**Total Requests**
- Cumulative number of tile requests since Redis started
- Includes both cache hits and misses

**Cache Hit Rate** (duplicate from above)
- Critical performance metric
- Target: 85-95%

**Average Response Time**
- Average time to deliver a tile
- Target: <50ms from cache, <200ms from Martin
- >500ms: Performance issue

**Cached Tiles by Layer**
Breakdown of cached tiles per map layer:
- Useful for identifying which layers are most accessed
- Can help optimize pregeneration strategy

---

## Auto-Refresh

**Dropdown Options:**
- **Off**: Manual refresh only (default)
- **Every 5s**: Real-time monitoring (high frequency)
- **Every 10s**: Active monitoring
- **Every 30s**: Passive monitoring

Use auto-refresh when:
- Monitoring cache fill during pregeneration
- Observing performance under load
- Troubleshooting issues

**Manual Refresh Button**
- Click to refresh all data immediately
- Shows spinner during loading

---

## Common Tasks

### Check System Health

1. Navigate to Maps Monitoring page
2. Check Service Status Overview
   - All services should be ✅ Running and Healthy
3. Verify cache hit rate >85%
4. Verify Martin has all expected layers

### Monitor Cache Fill

1. After running tile pregeneration:
   ```bash
   npm run tiles:pregenerate
   ```
2. Enable auto-refresh (Every 5s)
3. Watch "Total Cached Tiles" increase
4. Expected: ~87,381 tiles for zoom 0-8
5. Watch "Cache Hit Rate" improve over time

### Troubleshoot Slow Maps

1. Check "Cache Hit Rate"
   - <60%: Cache not effective, consider pregeneration
2. Check "Average Response Time"
   - >200ms: Possible database/Martin issue
3. Check "Service Status"
   - Verify all services are healthy
4. Check "Memory Usage"
   - >90%: May need to increase Redis memory limit

### Clear Stale Cache

1. Click "Clear Cache" button
2. Confirm in dialog
3. Wait for confirmation message
4. Cache will refill on-demand
5. Consider running pregeneration again

---

## Performance Targets

### Healthy System

| Metric | Target | Status |
|--------|--------|--------|
| Cache Hit Rate | >85% | 🟢 Excellent |
| Redis Memory | <80% | 🟢 Good |
| Avg Response Time | <50ms | 🟢 Fast |
| Martin Status | Healthy | 🟢 OK |
| Cached Tiles | >13,000 | 🟢 Good |

### Warning Signs

| Metric | Warning | Action |
|--------|---------|--------|
| Cache Hit Rate | <60% | Run pregeneration |
| Redis Memory | >90% | Increase memory limit |
| Avg Response Time | >200ms | Check Martin/PostGIS |
| Martin Status | Unhealthy | Check Docker logs |
| Cached Tiles | <5,000 | Run pregeneration |

---

## API Endpoints

The monitoring dashboard uses these tRPC endpoints:

**`mapMonitoring.getCacheStats`**
- Returns Redis cache statistics
- Admin only
- Auto-refresh compatible

**`mapMonitoring.getMartinStatus`**
- Returns Martin tile server status
- Admin only
- Checks health and catalog

**`mapMonitoring.getServiceStatuses`**
- Returns all service statuses
- Admin only
- Comprehensive health check

**`mapMonitoring.getTileMetrics`**
- Returns tile performance metrics
- Admin only
- Includes per-layer breakdown

**`mapMonitoring.clearCache`**
- Clears Redis cache (mutation)
- Admin only
- Requires confirmation

---

## Automation

### Startup Integration

Maps monitoring services are automatically started with IxStats:

**Development:**
```bash
./start-development.sh
# Starts Redis → Martin → Next.js
```

**Production:**
```bash
./start-production.sh
# Starts Redis → Martin → Next.js
```

### Maintenance Scripts

**Check services:**
```bash
npm run services:check
```

**Redis stats:**
```bash
npm run redis:stats
```

**Martin status:**
```bash
npm run martin:status
```

**Tile pregeneration:**
```bash
npm run tiles:pregenerate        # Zoom 0-8 (default)
npm run tiles:pregenerate-full   # Zoom 0-10 (all tiles)
```

---

## Troubleshooting

### Redis Not Connected

**Symptoms:**
- Red alert box in dashboard
- "Redis Not Connected" message
- Tile caching is disabled

**Solution:**
```bash
# Start Redis
./scripts/setup-redis.sh start

# Verify it's running
docker ps -f "name=ixstats-redis-cache"

# Test connection
docker exec ixstats-redis-cache redis-cli ping
```

### Martin Not Responding

**Symptoms:**
- Martin shows "Stopped" or "Unhealthy"
- No available layers listed
- Error message displayed

**Solution:**
```bash
# Check Martin status
./scripts/martin-tiles.sh status

# Restart Martin
./scripts/martin-tiles.sh restart

# Check logs
docker logs martin-tiles

# Verify endpoint
curl http://localhost:3800/health
```

### Low Cache Hit Rate

**Symptoms:**
- Cache hit rate <60%
- Slow map loading
- High average response time

**Solution:**
1. Run tile pregeneration:
   ```bash
   npm run tiles:pregenerate
   ```
2. Wait for completion (~3-5 minutes)
3. Check "Total Cached Tiles" increases to ~87,000
4. Monitor hit rate improvement over next hour

### High Memory Usage

**Symptoms:**
- Redis memory usage >90%
- Keys being evicted
- Unstable cache hit rate

**Solution:**
1. Check current memory limit:
   ```bash
   docker exec ixstats-redis-cache redis-cli CONFIG GET maxmemory
   ```
2. Increase limit if needed:
   ```bash
   # Edit docker run command in setup-redis.sh
   # Change --env REDIS_MAXMEMORY=2g to 4g or 8g
   ```
3. Restart Redis with new limit

---

## Best Practices

### Daily Operations

1. **Check dashboard once per day** during normal operations
2. **Monitor cache hit rate** - should be stable >85%
3. **Watch for service health changes**
4. **Check memory usage trends**

### Weekly Maintenance

1. **Run tile pregeneration** to refresh cache
2. **Review performance metrics** for trends
3. **Check for any evicted keys** (should be minimal)
4. **Verify all services are healthy**

### Before/After Deployments

1. **Before:** Clear cache if map data changed
2. **After:** Run tile pregeneration
3. **Monitor:** Watch cache fill and hit rate
4. **Verify:** All services restarted correctly

### Performance Optimization

1. **Pregenerate high-traffic zoom levels** (0-8)
2. **Monitor which layers are most accessed**
3. **Consider increasing Redis memory** for larger caches
4. **Tune Martin worker_processes** based on load

---

## Security

**Access Control:**
- Maps Monitoring is **admin-only**
- Requires elevated privileges
- All actions are audited

**Cache Clear:**
- Requires explicit confirmation
- Cannot be undone
- Impacts all users temporarily

**API Security:**
- All endpoints use `adminProcedure`
- Authenticated via Clerk
- Rate-limited for safety

---

## Support

### Documentation
- `/docs/MAPS_OPTIMIZATION_COMPLETE.md` - Full optimization details
- `/docs/MAPS_MONITORING_GUIDE.md` - This guide
- `/docs/VECTOR_TILES_API.md` - Tile API reference

### Scripts
- `./scripts/setup-redis.sh` - Redis management
- `./scripts/martin-tiles.sh` - Martin management
- `./scripts/check-services.sh` - Service health check

### Logs
- Redis: `docker logs ixstats-redis-cache`
- Martin: `docker logs martin-tiles`
- Next.js: PM2 logs or console output

---

## FAQ

**Q: Why is Martin showing "Unhealthy" but still working?**
A: Docker health check is misconfigured (checking port 3000 instead of 3800). The service is functional - this is a known issue with the Docker configuration.

**Q: How often should I run tile pregeneration?**
A: Weekly in production, or after any map data changes. Development environments can run on-demand.

**Q: What's the difference between cache hit rate in Redis stats vs Tile Metrics?**
A: They're the same metric, just displayed in two places for convenience.

**Q: Can I clear cache for a specific layer only?**
A: Not currently via the dashboard, but you can use the API with a custom pattern like `tile:map_layer_political:*`.

**Q: Why does cache hit rate start at 0% after clearing?**
A: The cache is empty, so all requests are misses. It will improve as tiles are cached on-demand or via pregeneration.

**Q: How much memory should Redis use?**
A: For zoom 0-8 pregeneration: ~6-10MB. For zoom 0-10: ~50-100MB. Configure 2GB max to allow for growth.

**Q: What happens if Redis runs out of memory?**
A: Redis will evict least-recently-used (LRU) tiles automatically. Cache hit rate may decrease, but the system continues to function.

---

**Last Updated:** October 31, 2025
**Version:** 1.0.0
**Status:** Production Ready ✅
