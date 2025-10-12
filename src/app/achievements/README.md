# Achievements & Leaderboards System

**Status:** 90% Complete (Production Ready)
**Location:** `/src/app/achievements/` & `/src/app/leaderboards/`
**API Router:** `/src/server/api/routers/achievements.ts`

## Overview

The Achievements & Leaderboards system provides comprehensive tracking of player accomplishments, global rankings, and competitive metrics across the IxStats platform. Players earn achievements through gameplay milestones, unlock rewards, and compete on global leaderboards across multiple metrics.

## Architecture

### Components

#### Achievements Page (`/achievements/page.tsx`)
- **Achievement Tracking**: Display all achievements earned by the player's nation
- **Category Filtering**: Economy, Diplomacy, Culture, and General categories
- **Rarity System**: Common, Uncommon, Rare, Epic, and Legendary tiers
- **Global Leaderboard**: Rankings by total achievement points
- **Real-time Notifications**: Live updates via WebSocket when achievements are unlocked
- **Achievement Profile**: Personal stats including total achievements, points, and rank

#### Leaderboards Page (`/leaderboards/page.tsx`)
- **Multi-Metric Rankings**: GDP, GDP per capita, population, achievements, and diplomatic influence
- **Personal Positioning**: Track your nation's rank across all metrics
- **Top 20 Display**: Shows top-performing nations in each category
- **Real-time Updates**: Leaderboards update as nations progress
- **User Highlight**: Visual emphasis on the player's country in rankings

### Database Schema

```prisma
model Achievement {
  id          String   @id @default(cuid())
  countryId   String
  title       String
  description String
  category    String   // Economy, Diplomacy, Culture, General
  rarity      String   // Common, Uncommon, Rare, Epic, Legendary
  points      Int      @default(0)
  icon        String   @default("🏆")
  unlockedAt  DateTime @default(now())
  country     Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  @@index([countryId])
  @@index([category])
  @@index([rarity])
}
```

### API Endpoints

```typescript
// Get all achievements for a country
achievements.getAllByCountry({ countryId: string })

// Get achievement leaderboard
achievements.getLeaderboard({
  limit: number,
  category?: string
})

// Unlock achievement (admin/system)
achievements.unlock({
  countryId: string,
  title: string,
  description: string,
  category: string,
  rarity: string,
  points: number,
  icon?: string
})
```

## Achievement Categories

### Economy Achievements
- First GDP milestone achievements
- Economic growth rate achievements
- Trade balance achievements
- Prosperity milestones

### Diplomacy Achievements
- Embassy network achievements
- Treaty and alliance achievements
- Cultural exchange achievements
- Diplomatic influence milestones

### Culture Achievements
- Cultural program achievements
- Educational milestones
- Arts and heritage achievements
- Social development achievements

### General Achievements
- Platform engagement achievements
- System usage milestones
- Community participation
- Special event achievements

## Rarity System

| Rarity | Points Range | Difficulty | Color Theme |
|--------|--------------|------------|-------------|
| Common | 10-25 | Easy to unlock | Gray |
| Uncommon | 30-50 | Moderate effort | Green |
| Rare | 60-100 | Significant achievement | Blue |
| Epic | 150-250 | Major accomplishment | Purple |
| Legendary | 300-500 | Exceptional milestone | Gold |

## Real-Time Notification System

### Achievement Unlocking Flow
1. **Trigger Event**: Player action meets achievement criteria
2. **Server Validation**: Backend verifies achievement conditions
3. **Database Update**: Achievement record created
4. **WebSocket Broadcast**: Real-time notification sent to player
5. **UI Integration**: Dynamic Island + Toast notifications display

### Notification Channels
- **Dynamic Island**: Prominent achievement display (iOS-style)
- **Toast Notifications**: Brief success message
- **Notification Center**: Persistent achievement log
- **Achievement Page**: Full achievement details

### Hook Integration
```typescript
const achievementNotifications = useAchievementNotifications({
  countryId: userProfile?.countryId || "",
  countryName: userProfile?.country?.name || "",
  enableRealTime: true,
  enableToast: true,
  enableDynamicIsland: true,
  enableNotificationCenter: true
});
```

## Leaderboard Metrics

### Economic Metrics
- **Total GDP**: Measures overall economic power
- **GDP Per Capita**: Measures citizen prosperity and efficiency
- **Population**: Measures nation scale and demographic strength

### Competitive Metrics
- **Achievements**: Total achievement points earned
- **Diplomatic Influence**: Embassy network strength and relationship quality

### Ranking Algorithm
```typescript
// Leaderboards update in real-time based on:
- Current country metrics from database
- Achievement points from achievement system
- Diplomatic influence from diplomatic router
- Real-time sorting and positioning
```

## Implementation Status

### ✅ Complete (90%)
- Full achievement tracking system
- Rarity-based point system
- Category-based organization
- Global leaderboard with multiple metrics
- Real-time WebSocket notifications
- Dynamic Island integration
- Personal positioning tracking
- Achievement unlocking API
- Database schema and migrations

### 📋 Remaining (v1.1)
- Additional achievement types (seasonal, hidden)
- Tournament/season-based leaderboards
- Achievement progress tracking (partial completion)
- Badge and flair system
- Achievement showcase on profiles

## Usage Examples

### Checking Achievements
```typescript
// Get user's achievements
const { data: myAchievements } = api.achievements.getAllByCountry.useQuery({
  countryId: userProfile?.countryId || ""
});

// Filter by category
const economicAchievements = myAchievements?.filter(
  a => a.category === "Economy"
);
```

### Viewing Leaderboards
```typescript
// Get leaderboard for specific metric
const { data: leaderboard } = api.achievements.getLeaderboard.useQuery({
  limit: 20,
  category: selectedCategory !== "all" ? selectedCategory : undefined
});

// Find user rank
const userRank = leaderboard?.findIndex(
  entry => entry.countryId === userProfile?.countryId
) + 1;
```

### Unlocking Achievements (Backend)
```typescript
// System triggers achievement unlock
await ctx.db.achievement.create({
  data: {
    countryId: country.id,
    title: "Economic Titan",
    description: "Achieved GDP of $1 trillion",
    category: "Economy",
    rarity: "Epic",
    points: 200,
    icon: "💰"
  }
});
```

## Mobile Responsiveness

- **Responsive Grid**: Achievements display in 1-3 columns based on screen size
- **Touch Interactions**: Tap to view achievement details
- **Performance Optimized**: Lazy loading for large achievement lists
- **Compact Display**: Leaderboard optimized for mobile viewing

## Future Enhancements (v1.1+)

- **Seasonal Achievements**: Time-limited special achievements
- **Hidden Achievements**: Secret unlockables with discovery mechanics
- **Achievement Progress**: Track partial completion towards achievements
- **Badges & Flairs**: Visual rewards displayed on profiles and posts
- **Achievement Showcase**: Featured achievements on user profiles
- **Team Achievements**: Collaborative achievements for alliances
- **Historical Leaderboards**: Archive of past season rankings

## Related Systems

- **User Profiles** (`/src/app/profile/`): Display achievements on user profiles
- **Dynamic Island** (`/src/components/DynamicIsland/`): Achievement notifications
- **Notifications** (`/src/server/api/routers/notifications.ts`): Notification delivery
- **Countries** (`/src/server/api/routers/countries.ts`): Country metrics for leaderboards
- **Diplomatic** (`/src/server/api/routers/diplomatic.ts`): Diplomatic influence metrics

## Documentation

- Main README: [/README.md](../../README.md)
- Implementation Status: [/IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
- API Documentation: Review `/src/server/api/routers/achievements.ts` for complete API reference
