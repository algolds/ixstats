# Achievement System - Quick Reference

## Quick Start

### 1. Run Seeding Script (Validation)
```bash
npx tsx scripts/seed-achievements.ts
```

### 2. Add Auto-Unlock to Router
```typescript
import { achievementService } from '~/lib/achievement-service';

// After mutation completes
achievementService
  .checkAndUnlockCategory(userId, countryId, db, 'Economic')
  .catch(err => console.error(err));
```

### 3. Test Achievement Unlocking
- Update country data via UI
- Check console for unlock messages
- Verify notification appears

## Achievement Categories

| Category | Achievements | Points | Key Metrics |
|----------|--------------|--------|-------------|
| Economic | 15 | 915 | GDP, growth rate, unemployment |
| Military | 10 | 685 | Branches, personnel, spending % |
| Diplomatic | 10 | 680 | Embassies, treaties, alliances |
| Government | 10 | 570 | Components, government type |
| Social | 5 | 230 | ThinkPages, followers, trending |
| General | 10 | 445 | Account age, activity, milestones |

**Total**: 60 achievements, 3,225 points

## Rarity Tiers

| Rarity | Count | Points | Difficulty |
|--------|-------|--------|------------|
| Common | 11 | 5-15 | Easy, early milestones |
| Uncommon | 17 | 25-30 | Moderate, mid-game |
| Rare | 18 | 40-60 | Challenging, advanced |
| Epic | 12 | 80-120 | Very difficult, major accomplishments |
| Legendary | 2 | 200-250 | Extremely rare, elite status |

## Top Achievements (By Points)

1. **Global Economic Titan** (Legendary, 250 pts) - $10T GDP
2. **Global Military Force** (Legendary, 200 pts) - 5M personnel
3. **Ultra Prosperity** (Epic, 120 pts) - $100K GDP per capita
4. **One Year Anniversary** (Epic, 120 pts) - Active for 1 year
5. **Alliance Network** (Epic, 120 pts) - Form 10 alliances

## Service Methods

### Auto-Unlock All Categories
```typescript
await achievementService.checkAndUnlock(userId, countryId, db);
```

### Auto-Unlock Specific Category (Faster)
```typescript
await achievementService.checkAndUnlockCategory(userId, countryId, db, 'Economic');
```

### Manual Unlock (Admin/Events)
```typescript
await achievementService.unlockSpecific(userId, 'econ-trillion-club', db);
```

### Get User Progress
```typescript
const progress = await achievementService.getProgress(userId, db);
// { totalUnlocked: 12, totalPoints: 340, byCategory: {...}, ... }
```

## API Endpoints

### Get Recent Achievements
```typescript
trpc.achievements.getRecentByCountry.query({
  countryId: 'country-123',
  limit: 10
});
```

### Get All Country Achievements
```typescript
trpc.achievements.getAllByCountry.query({
  countryId: 'country-123'
});
```

### Get Leaderboard
```typescript
trpc.achievements.getLeaderboard.query({
  limit: 20,
  category: 'Economic' // Optional
});
```

## Achievement IDs (Most Common)

### Economic
- `econ-first-million` - First $1M GDP
- `econ-trillion-club` - $1T GDP
- `econ-first-world-status` - $50K GDP per capita
- `econ-full-employment` - <3% unemployment

### Military
- `mil-first-branch` - First military branch
- `mil-full-spectrum` - 5 military branches
- `mil-military-superpower` - 5% GDP on military

### Diplomatic
- `dip-first-embassy` - First embassy
- `dip-embassy-network` - 25 embassies
- `dip-global-presence` - 10 embassies

### Government
- `gov-first-component` - First atomic component
- `gov-complex-system` - 15 atomic components
- `gov-democracy` - Democratic governance

### Social
- `social-first-thinkpage` - First ThinkPage
- `social-popular` - 100 followers
- `social-trending` - Trending post

### General
- `gen-welcome` - Account creation
- `gen-first-country` - First country claim
- `gen-one-year` - 1 year active

## Integration Examples

### Countries Router
```typescript
// After economic data update
achievementService
  .checkAndUnlockCategory(userId, countryId, db, 'Economic')
  .catch(err => console.error(err));
```

### Diplomatic Router
```typescript
// After embassy creation
achievementService
  .checkAndUnlockCategory(userId, countryId, db, 'Diplomatic')
  .catch(err => console.error(err));
```

### Military Router
```typescript
// After branch creation
achievementService
  .checkAndUnlockCategory(userId, countryId, db, 'Military')
  .catch(err => console.error(err));
```

### Government Router
```typescript
// After component implementation
achievementService
  .checkAndUnlockCategory(userId, countryId, db, 'Government')
  .catch(err => console.error(err));
```

### Social Router
```typescript
// After ThinkPage creation
achievementService
  .checkAndUnlockCategory(userId, countryId, db, 'Social')
  .catch(err => console.error(err));
```

### Users Router
```typescript
// On account creation
achievementService.unlockSpecific(userId, 'gen-welcome', db);

// On first country claim
achievementService.unlockSpecific(userId, 'gen-first-country', db);
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/achievement-definitions.ts` | 60 achievement definitions |
| `src/lib/achievement-service.ts` | Auto-unlock service |
| `scripts/seed-achievements.ts` | Validation script |
| `docs/ACHIEVEMENT_SYSTEM.md` | Complete documentation |
| `docs/ACHIEVEMENT_INTEGRATION.md` | Integration guide |
| `docs/ACHIEVEMENT_QUICK_REFERENCE.md` | This file |

## Performance Tips

1. **Use category checks** when you know which category changed
2. **Non-blocking execution** - Use `.catch()` instead of `await`
3. **Batch operations** - Don't check in tight loops
4. **Monitor logs** - Check for unlock messages in console

## Troubleshooting

### Achievement Not Unlocking
- Check condition logic in `achievement-definitions.ts`
- Verify data is populated (GDP, population, etc.)
- Review console logs for errors

### Performance Issues
- Use `checkAndUnlockCategory()` instead of `checkAndUnlock()`
- Ensure non-blocking execution (`.catch()` pattern)
- Review database query performance

### Leaderboard Empty
- Ensure users have unlocked achievements
- Check UserAchievement table has records
- Verify country ownership is correct

## Statistics

- **Total Achievements**: 60
- **Total Points**: 3,225
- **Categories**: 6
- **Rarity Levels**: 5
- **Auto-Unlock**: Yes
- **Notifications**: Yes
- **Leaderboard**: Yes

## Next Steps

1. Add auto-unlock to remaining routers
2. Test with real gameplay
3. Monitor performance
4. Gather user feedback
5. Plan v1.2 enhancements (tiers, quests, rewards)

---

**For detailed information, see:**
- Full documentation: `/docs/ACHIEVEMENT_SYSTEM.md`
- Integration guide: `/docs/ACHIEVEMENT_INTEGRATION.md`
