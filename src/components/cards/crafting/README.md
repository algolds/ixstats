# IxCards Crafting System

**Phase 3: Card Crafting/Fusion/Evolution**

> **Status (verified 2026-09-29): PARTIAL.** The workbench, animation, and `crafting.getRecipes` / `getRecipeById` / `craftCard` exist, but `/vault/crafting` is not linked from the Vault nav, the page passes card-definition IDs where `craftCard` expects `CardOwnership` IDs, `successRate` units disagree between schema (0–1) and router (0–100), and the recipe seed does not match the Prisma model. See [Known Issues](#known-issues).

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
- Facet (glass) workbench styling

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

#### 2. Recipe selection (inline)
There is no `RecipeBrowser` component. `/vault/crafting` renders a horizontal row of recipe buttons from `crafting.getRecipes({})` and passes the selected ID to `CraftingWorkbench`. `getRecipes` itself supports `filter` (ALL, UNLOCKED, LOCKED, COMPLETED), `recipeType`, and `search`.

#### 3. **CraftingAnimation.tsx**
Success/failure animation component (rendered by `CraftingWorkbench` after a craft).

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
Main crafting page (`src/app/vault/crafting/page.tsx`), rendered inside the Vault layout but not listed in the Vault sidebar.

**Layout:**
- "Select Crafting Recipe" row of recipe buttons
- `CraftingWorkbench` fed with the user's cards from `cards.getMyCards({ sortBy: "value" })`

Not built: statistics overview, crafting history section, help section.

## Backend

### tRPC Router: `crafting` (`src/server/api/routers/crafting/recipes.ts`)

**Endpoints:**

1. **`getRecipes`** (Protected)
   - Filter recipes by status (ALL, UNLOCKED, LOCKED, COMPLETED), `recipeType`, and name/description search
   - Returns active recipes with `isUnlocked` (Vault level (from Vault XP) `>= minLevel`), `isCompleted`, `completedCount`

2. **`getRecipeById`** (Protected)
   - Detailed recipe information including unlock status, completion count, recent crafts

3. **`craftCard`** (Protected)
   - Input: `recipeId`, `materialCardIds` (**`CardOwnership` IDs**)
   - Respects `isMaintenanceMode` / `isCraftingEnabled`; validates ownership, materials, credits, unlock level
   - Rolls success, consumes materials, mints a result card on success, awards card XP, records history

**Not implemented** (previously documented): `getCraftingHistory`, `getCraftingStats`, `createRecipe`, `updateRecipe`, `adminGetAllRecipes`. Recipes are managed through the seed file or direct DB edits.

## Database Models

### CraftingRecipe

From `prisma/schema/cards.prisma`:

```prisma
model CraftingRecipe {
  id              String            @id @default(cuid())
  name            String
  description     String?
  recipeType      String            // "FUSION" | "EVOLUTION"
  requiredCardIds Json              // Array of card IDs or criteria
  requiredCount   Int               @default(1)
  resultCardId    String?           // Specific result card (null = random by rarity)
  resultRarity    String?           // If random result, rarity constraint
  ixCreditsCost   Int               @default(0)
  successRate     Float             @default(1.0) // schema comment: 0.0-1.0
  minLevel        Int               @default(1)
  collectorXPGain Int               @default(0)
  isActive        Boolean           @default(true)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  craftingHistory CraftingHistory[]
}
```

**Material Requirement Format** (`requiredCardIds`): either specific card IDs, or criteria objects validated by count only (`requiredCount`):
```json
[
  { "rarity": "RARE", "quantity": 2 }
]
```

**Unlock requirement:** only `minLevel` (compared with the player's Vault level, `floor(vaultXp / xpPerLevel) + 1`; `User.collectorLevel` is not used because nothing writes it). Achievement and prerequisite-recipe unlocks are not implemented.

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
   - Intended to upgrade a single card to higher rarity
   - More reliable than fusion (higher seeded success rates)
   - Currently consumes the material and mints a new card (identity is not preserved unless the recipe sets `resultCardId`)

### Success Rate System

Seeded rates (percent): Fusion 95 / 85 / 70 / 30 / 15, Evolution 100 / 95 / 85 / 70 / 50, Lore Card Fusion 80, Event Card Fusion 60.

Success is determined by:
```typescript
const roll = Math.random() * 100;
const success = roll <= recipe.successRate;
```
Note: this treats `successRate` as a percentage, while the schema default (`1.0`) and comment assume 0–1.

### Cost System

**Seeded IxCredits costs:**
- Fusion: Common→Uncommon 250, Uncommon→Rare 500, Rare→Ultra Rare 1,000, Epic→Legendary 5,000, "Mythic" 10,000
- Evolution: 200 / 400 / 800 / 2,000 / 4,000 (Common→Uncommon … Epic→Legendary)
- Special: Lore Card Fusion 750, Event Card Fusion 1,500

Credits are spent with `SPEND_CRAFT` on every attempt, successful or not.

### XP Rewards

`collectorXPGain` is granted to the **newly crafted card** (`grantCardXp(..., "CRAFT")`) on success and recorded in `CraftingHistory`. Crafting does not change `User.collectorLevel`.

### Unlock System

Recipes can be locked behind a **minimum Vault level** (`minLevel`). Required achievements and completed-recipe prerequisites are not implemented.

## Seed Data

Sample recipes provided in `/prisma/seeds/crafting-recipes.ts`:

- 5 Fusion recipes (Common → "Mythic")
- 5 Evolution recipes (Common → Legendary)
- 2 Special recipes (Lore Card, Event Card)

**Run seed:**
```bash
npx tsx prisma/seeds/crafting-recipes.ts
```

⚠️ The seed objects use legacy field names (`materialsRequired`, `resultType`, `collectorXP`, `unlockRequirement`) that are not columns on `CraftingRecipe`, and a `MYTHIC` rarity that is not in `CardRarity`; `prisma.craftingRecipe.create({ data: recipe })` will fail until the seed is updated.

## Atomic Transactions

`craftCard` runs in a Prisma transaction:

1. Spend IxCredits (`vaultService.spendCreditsTx`, `SPEND_CRAFT`; fails on insufficient balance)
2. Delete consumed `CardOwnership` rows
3. On success: create a new `Card` (from `resultCardId`, else a generic "<recipe> Result" NATION card with `resultRarity`) and its ownership
4. Award card XP to the new card
5. Record crafting history

Ownership and material validation happen just before the transaction. **If any step inside fails, the transaction rolls back.**

## Integration Points

### Vault System
- IxCredits balance checking
- Credit spending with transaction type `SPEND_CRAFT`
- Metadata includes recipe ID and name

### Card System
- Card instance ownership verification
- Card creation for successful crafts
- Card deletion for consumed materials
- Card XP for the crafted card (`src/lib/cards/xp-utils.ts`)

### User System
- Vault level read for recipe unlocks (not modified by crafting)

## UI/UX Features

### Facet Design
Components use Facet primitives: an opaque `Card` workbench with `Stat` insets, the card picker in a
`Dialog`, and the crafting result as a full-screen `Dialog` (a Vault reveal moment; Escape or a click continues).

### Animations
- Motion (`motion/react`) for smooth transitions
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
   - The page loads the full `cards.getMyCards` result (no pagination)

2. **Recipe Filtering**
   - Server-side filter/search on `getRecipes` (the page currently requests all recipes)

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

**Errors surface as TRPCError messages, shown with `useNotify()` (toast / Halo).**

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
- `motion` (`motion/react`) - Animations
- `~/lib/vault/vault-service` - IxCredits management
- `~/lib/cards/xp-utils` - Card XP
- `~/components/ui/comet-card` - Facet (glass) components
- `~/components/cards/display/CardDisplay` - Card rendering

## File Structure

```
src/
├── components/cards/crafting/
│   ├── CraftingWorkbench.tsx     # Main crafting interface
│   ├── CraftingAnimation.tsx     # Success/failure animation
│   └── README.md                 # This file (no barrel index.ts)
├── app/vault/crafting/
│   └── page.tsx                  # Crafting page (inline recipe picker)
└── server/api/routers/crafting/
    ├── index.ts                  # Router export
    └── recipes.ts                # getRecipes, getRecipeById, craftCard

prisma/
├── schema/cards.prisma           # CraftingRecipe, CraftingHistory
└── seeds/
    └── crafting-recipes.ts       # Sample recipes (needs schema alignment)
```

## Known Issues

- `/vault/crafting` maps `cards.getMyCards` results to `CardInstance` with `id = card definition ID`; `craftCard` looks up `CardOwnership` IDs, so crafts fail with "You don't own all the specified material cards".
- `successRate` percent vs fraction mismatch (see above).
- Seed file field names do not match the model.
- Evolution does not preserve card identity: success always mints a new card.

## Version History

- **v1.0.0** (Current) - Initial crafting system implementation
  - Fusion and evolution mechanics
  - Success rate system
  - XP rewards and progression
  - 12 sample recipes
  - Facet (glass) workbench UI

---

**For questions or issues, contact the IxCards development team.**
