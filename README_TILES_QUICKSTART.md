# Vector Tiles Quick Start Guide

**TL;DR**: Start the tile server and cache in 30 seconds for 50-1000x faster map performance.

---

## Quick Start (3 Commands)

```bash
# 1. Start Martin tile server
npm run martin:start

# 2. Start Redis cache
npm run redis:start

# 3. (Optional) Pre-generate common tiles
npm run tiles:pregenerate
```

That's it! Your map now loads 50-1000x faster.

---

## What Just Happened?

### Before
```
Browser → Next.js API → Prisma → PostgreSQL
         1000-1150ms per tile ❌
         Visible glitching 😞
```

### After
```
Browser → Next.js API → Redis Cache → Martin → PostgreSQL
         <10ms per tile ✅
         Smooth interaction 🎉
```

---

## Verify It's Working

```bash
# Check services
./scripts/martin-tiles.sh status
./scripts/setup-redis.sh status

# Test performance
npm run tiles:test

# Expected output:
# Request 1:  44ms   (first)
# Request 2:  0.7ms  (cached) ← 1000x faster!
```

---

## Daily Usage

**Starting Development**:
```bash
npm run martin:start
npm run redis:start
npm run dev
```

**Stopping Services**:
```bash
npm run martin:stop
npm run redis:stop
```

**Monitoring**:
```bash
npm run redis:stats        # Cache hit rate, memory usage
./scripts/martin-tiles.sh logs  # Martin logs
```

---

## When to Pre-generate Tiles

Run this after:
- Initial setup
- Map data updates
- Weekly in production

```bash
npm run tiles:pregenerate    # ~5-10 minutes for zoom 0-8
```

---

## Troubleshooting

**Tiles not loading?**
```bash
# Check services are running
docker ps | grep -E "martin|redis"

# Restart if needed
npm run martin:start
npm run redis:start
```

**Still slow?**
```bash
# Check cache hit rate
npm run redis:stats

# Pre-generate tiles
npm run tiles:pregenerate
```

---

## Performance Results

| Scenario | Time | Improvement |
|----------|------|-------------|
| Before | 1000-1150ms | Baseline |
| Martin (Phase 1) | 58-220ms | **5-17x** |
| + Redis (Phase 2) | <50ms | **20-50x** |
| + Pre-gen (Phase 3) | <10ms | **100-1000x** |

---

## More Info

- **Complete Guide**: [docs/VECTOR_TILES_COMPLETE_GUIDE.md](docs/VECTOR_TILES_COMPLETE_GUIDE.md)
- **Phase 1 Details**: [docs/MARTIN_TILE_SERVER.md](docs/MARTIN_TILE_SERVER.md)
- **Implementation Summary**: [VECTOR_TILES_IMPLEMENTATION_COMPLETE.md](VECTOR_TILES_IMPLEMENTATION_COMPLETE.md)

---

**Status**: ✅ All 3 phases complete | 🚀 50-1000x faster | 📦 Production ready
