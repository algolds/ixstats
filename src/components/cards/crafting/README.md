# IxCards Crafting System

**Phase 3: Card Crafting/Fusion/Evolution**

The crafting system allows players to combine or evolve cards to create more powerful variants. This system features fusion (combining multiple cards) and evolution (upgrading individual cards) mechanics with dynamic success rates and XP rewards.

## Architecture

### Components

#### 1. **CraftingWorkbench.tsx**
Main crafting interface where players perform crafting operations.

**Features:**
- Card slot management (drag-drop or click to add)
- Material requirements display
- Success rate calculator
- IxCredits cost display
- "Craft" button with validation
- Result preview system
- Glass physics workbench styling

**Props:**
```typescript
interface CraftingWorkbenchProps {
  recipeId: string | null;        // Selected recipe ID
  availableCards: CardInstance[]; // User's inventory
  onCraftComplete?: (result: any) => void; // Completion callback
}
```

**Usage:**
```tsx
<CraftingWorkbench
  recipeId="recipe-123"
  availableCards={userCards}
  onCraftComplete={(result) => {
    console.log('Crafted:', result);
  }}
/>
```

#### 2. **RecipeBrowser.tsx**
Recipe selection and filtering interface.

**Features:**
- Recipe grid display
- Filter by: ALL, UNLOCKED, LOCKED, COMPLETED
- Search functionality
- Recipe details preview
- Unlock status indicators
- Completion tracking

**Props:**
```typescript
interface RecipeBrowserProps {
  selectedRecipeId: string | null;
  onRecipeSelect: (recipeId: string) => void;
}
```

**Usage:**
```tsx
<RecipeBrowser
  selectedRecipeId={recipeId}
  onRecipeSelect={setRecipeId}
/>
```

#### 3. **CraftingAnimation.tsx**
Success/failure animation component.

**Features:**
- Glass fusion effect (cards merging)
- Particle effects for success
- Success/failure reveal
- New card showcase
- XP gain display
- Auto-dismiss after 7 seconds

**Props:**
```typescript
interface CraftingAnimationProps {
  success: boolean;
  resultCard?: any | null;
  xpGained: number;
  onComplete: () => void;
}
```

**Usage:**
```tsx
<CraftingAnimation
  success={true}
  resultCard={newCard}
  xpGained={100}
  onComplete={() => console.log('Animation done')}
/>
```

### Page

#### `/vault/crafting`
Main crafting hub page.

**Layout:**
- Header with title and description
- Crafting statistics overview (4-stat grid)
- Two-column layout:
  - Left: RecipeBrowser (1/3 width on desktop)
  - Right: CraftingWorkbench (2/3 width on desktop)
- Recent crafting history section
- Help section with crafting instructions

## Backend

### tRPC Router: `crafting.ts`

**Endpoints:**

1. **`getRecipes`** (Protected)
   - Filter recipes by status (ALL, UNLOCKED, LOCKED, COMPLETED)
   - Search by name/description
   - Returns recipes with unlock status

2. **`getRecipeById`** (Protected)
   - Get detailed recipe information
   - Includes unlock status, completion count, recent crafts

3. **`craftCard`** (Protected)
   - Execute crafting operation
   - Validates materials, credits, unlock status
   - Calculates success based on success rate
   - Creates result card if successful
   - Awards XP and updates collector level
   - Records crafting history

4. **`getCraftingHistory`** (Protected)
   - Get user's crafting history
   - Pagination support
   - Filter by success status

5. **`getCraftingStats`** (Protected)
   - Get aggregate crafting statistics
   - Total crafts, success rate, XP gained, credits spent

6. **`createRecipe`** (Admin)
   - Create new crafting recipe
   - Auto-calculates cost, success rate, XP based on rarity

7. **`updateRecipe`** (Admin)
   - Update existing recipe
   - Toggle active status

8. **`adminGetAllRecipes`** (Admin)
   - Get all recipes including inactive
   - Includes craft count statistics

## Database Models

### CraftingRecipe

```prisma
model CraftingRecipe {
  id                String   @id @default(cuid())
  name              String
  description       String?
  recipeType        String   // FUSION or EVOLUTION
  resultCardId      String?  // Card template ID
  resultRarity      String   // Rarity of result
  resultType        String   // CardType of result
  materialsRequired Json     // Array of material requirements
  ixCreditsCost     Int      @default(0)
  successRate       Float    @default(100.0)
  unlockRequirement Json?    // Unlock conditions
  isActive          Boolean  @default(true)
  collectorXP       Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  craftingHistory   CraftingHistory[]
}
```

**Material Requirement Format:**
```json
[
  {
    "cardId": "optional-specific-card-id",
    "rarity": "RARE",
    "type": "NATION",
    "quantity": 2
  }
]
```

**Unlock Requirement Format:**
```json
{
  "minLevel": 5,
  "achievements": ["achievement-id-1"],
  "completedRecipes": ["recipe-id-1"]
}
```

### CraftingHistory

```prisma
model CraftingHistory {
  id              String          @id @default(cuid())
  userId          String
  recipeId        String
  materialsUsed   Json            // Array of card instance IDs
  success         Boolean
  resultCardId    String?         // Created card instance ID
  ixCreditsSpent  Int
  collectorXPGain Int
  craftedAt       DateTime        @default(now())
  user            User            @relation(...)
  recipe          CraftingRecipe  @relation(...)
}
```

## Crafting Mechanics

### Recipe Types

1. **FUSION**
   - Combine 2+ cards to create a new card
   - Materials are consumed on craft attempt
   - Lower success rates for higher rarities
   - Result rarity determined by recipe

2. **EVOLUTION**
   - Upgrade a single card to higher rarity
   - More reliable than fusion (higher success rates)
   - Preserves card identity
   - Requires specific base card

### Success Rate System

**Default rates by rarity:**
- COMMON: 100%
- UNCOMMON: 95%
- RARE: 85%
- ULTRA_RARE: 70%
- EPIC: 50%
- LEGENDARY: 30%
- MYTHIC: 15%

Success is determined by:
```typescript
const roll = Math.random() * 100;
const success = roll <= recipe.successRate;
```

### Cost System

**IxCredits cost by rarity:**
- COMMON: 100
- UNCOMMON: 250
- RARE: 500
- ULTRA_RARE: 1,000
- EPIC: 2,500
- LEGENDARY: 5,000
- MYTHIC: 10,000

### XP Rewards

**Collector XP by rarity:**
- COMMON: 10 XP
- UNCOMMON: 25 XP
- RARE: 50 XP
- ULTRA_RARE: 100 XP
- EPIC: 250 XP
- LEGENDARY: 500 XP
- MYTHIC: 1,000 XP

**Level progression:**
- 1,000 XP per collector level
- Level = floor(totalXP / 1000) + 1

### Unlock System

Recipes can be locked behind requirements:
- **Minimum collector level**
- **Required achievements** (placeholder)
- **Completed recipes** (prerequisite recipes)

## Seed Data

Sample recipes provided in `/prisma/seeds/crafting-recipes.ts`:

- 5 Fusion recipes (Common → Mythic)
- 5 Evolution recipes (Common → Epic)
- 2 Special recipes (Lore Card, Event Card)

**Run seed:**
```bash
npx tsx prisma/seeds/crafting-recipes.ts
```

## Atomic Transactions

Crafting operations use Prisma transactions to ensure atomicity:

1. Validate user has sufficient IxCredits
2. Validate user owns all material cards
3. Deduct IxCredits
4. Delete consumed card instances
5. Create result card (if successful)
6. Award XP and update collector level
7. Record crafting history

**If any step fails, entire transaction rolls back.**

## Integration Points

### Vault System
- IxCredits balance checking
- Credit spending with transaction type `SPEND_CRAFT`
- Metadata includes recipe ID and name

### Card System
- Card instance ownership verification
- Card creation for successful crafts
- Card deletion for consumed materials

### User System
- Collector level tracking
- XP accumulation
- Level-up calculations

## UI/UX Features

### Glass Physics Design
All components use the glass physics design system:
- `glassDepth="parent"` - Page-level containers
- `glassDepth="child"` - Section containers
- `glassDepth="interactive"` - Interactive elements
- `glassDepth="modal"` - Modal overlays

### Animations
- Framer Motion for smooth transitions
- Card slot hover effects
- Fusion animation with particle effects
- Success/failure reveal sequences
- XP gain celebrations

### Responsive Design
- Mobile-first approach
- Grid layouts adjust for screen size
- Touch-friendly card selection
- Optimized for desktop crafting workflow

## Performance Considerations

1. **Inventory Loading**
   - Limit to 1,000 cards for crafting
   - Use pagination for larger inventories

2. **Recipe Filtering**
   - Client-side filtering for speed
   - Server-side search for accuracy

3. **Animation Performance**
   - GPU-accelerated transforms
   - Particle count limited to 30
   - Auto-cleanup on unmount

## Error Handling

**Common errors:**
- Insufficient IxCredits
- Missing material cards
- Recipe not unlocked
- Recipe not found
- Invalid materials

**All errors return TRPCError with appropriate messages.**

## Testing Checklist

- [ ] Recipe browsing and filtering
- [ ] Recipe unlock validation
- [ ] Card slot management
- [ ] Material validation
- [ ] IxCredits balance checking
- [ ] Success rate calculation
- [ ] Failed craft (materials consumed)
- [ ] Successful craft (card created)
- [ ] XP awarding and level-up
- [ ] Crafting history tracking
- [ ] Animation sequences
- [ ] Mobile responsiveness
- [ ] Transaction rollback on error

## Future Enhancements

1. **Advanced Materials**
   - Special catalysts to boost success rate
   - Rare materials for unique results

2. **Recipe Discovery**
   - Hidden recipes unlocked through experimentation
   - Seasonal/event-exclusive recipes

3. **Crafting Guilds**
   - Shared recipes within guilds
   - Cooperative crafting bonuses

4. **Bulk Crafting**
   - Queue multiple crafts
   - Batch processing with progress tracking

5. **Crafting Achievements**
   - First craft milestone
   - Master crafter titles
   - Recipe completion badges

## Dependencies

- `@trpc/server` - API layer
- `@prisma/client` - Database ORM
- `framer-motion` - Animations
- `~/lib/vault-service` - IxCredits management
- `~/lib/card-service` - Card operations
- `~/components/ui/comet-card` - Glass physics components
- `~/components/cards/display/CardDisplay` - Card rendering

## File Structure

```
src/
├── components/cards/crafting/
│   ├── CraftingWorkbench.tsx     # Main crafting interface
│   ├── RecipeBrowser.tsx         # Recipe selection
│   ├── CraftingAnimation.tsx     # Success/failure animation
│   ├── index.ts                  # Barrel exports
│   └── README.md                 # This file
├── app/vault/crafting/
│   └── page.tsx                  # Crafting hub page
└── server/api/routers/
    └── crafting.ts               # tRPC router

prisma/
├── schema.prisma                 # Database models
└── seeds/
    └── crafting-recipes.ts       # Sample recipes
```

## Version History

- **v1.0.0** (Current) - Initial crafting system implementation
  - Fusion and evolution mechanics
  - Success rate system
  - XP rewards and progression
  - 12 sample recipes
  - Full UI with glass physics design

---

**For questions or issues, contact the IxCards development team.**
