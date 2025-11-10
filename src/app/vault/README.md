# MyVault - IxCards Trading Card System

## Overview
MyVault is the complete trading card management system for IxStats, providing players with a comprehensive interface to manage their card collection, open packs, trade on the marketplace, and organize collections.

## Architecture

### Pages Structure
```
/vault
├── /                      # Dashboard (main landing page)
├── /packs                 # Pack management and opening
├── /market                # Card marketplace
├── /collections           # Collection browser
├── /collections/[slug]    # Individual collection view
└── /inventory             # All cards inventory
```

### Components

#### Layout Components (`src/components/vault/`)
- **VaultNavigation.tsx** - Sidebar navigation (desktop) / drawer (mobile)
  - Fixed left sidebar on desktop
  - Collapsible drawer on mobile
  - Active state highlighting with gold theme
  - Navigation links: Dashboard, Packs, Market, Collections, Inventory

- **VaultHeader.tsx** - Top header bar
  - IxCredits balance display (large, prominent)
  - Refresh button for balance
  - Notifications icon with badge
  - User profile dropdown (Clerk UserButton)
  - Mobile menu toggle

- **VaultDashboard.tsx** - Dashboard content component
  - Quick stats grid (total cards, deck value, unopened packs, active auctions)
  - Today's earnings breakdown with sources
  - Login streak display with daily bonus claim
  - Recent activity feed (last 10 transactions)

- **QuickActions.tsx** - Quick action buttons
  - 3 large glass cards with icons
  - Hover effects (scale + glow)
  - Navigation to main sections

#### Custom Hooks (`src/hooks/vault/`)
- **useVaultStats.ts** - Dashboard statistics (total cards, deck value, etc.)
- **useRecentActivity.ts** - Recent transactions feed
- **useCollections.ts** - Collection CRUD operations
- **useVaultBalance.ts** - IxCredits balance (existing, from Phase 1)
- **useDailyBonus.ts** - Daily bonus claim logic (existing, from Phase 1)
- **useEarnCredits.ts** - Credit earning utilities (existing, from Phase 1)

### Pages

#### 1. Dashboard (`/vault`)
**Purpose:** Main landing page showing overview and quick actions

**Features:**
- IxCredits balance (header)
- Quick stats grid (4 metrics)
- Today's earnings breakdown by source
- Quick action buttons (Open Pack, Visit Market, View Collections)
- Daily bonus claim button (if available)
- Login streak display with calendar
- Recent activity feed (last 10 transactions)

**Data Sources:**
- `vault.getBalance` - IxCredits balance, login streak
- `vault.getTodayEarnings` - Today's earnings with source breakdown
- `vault.getTransactions` - Recent activity feed
- `useVaultStats` - Card statistics (TODO: wire to cards API)

#### 2. Packs Page (`/vault/packs`)
**Purpose:** Purchase and open card packs

**Features:**
- Available packs grid (Starter, Booster, Premium)
- Pack purchase modal (from Agent 2)
- Unopened packs section with "Open Now" buttons
- Pack opening animation sequence (from Agent 2)
- Purchase history table

**Pack Types:**
- **Starter Pack:** 100 IxC, 5 cards, guaranteed uncommon
- **Booster Pack:** 250 IxC, 8 cards, chance for rare
- **Premium Pack:** 500 IxC, 12 cards, guaranteed rare+

**Integration Points:**
- Uses `PackPurchaseModal` from Agent 2
- Uses `PackOpeningSequence` from Agent 2

#### 3. Market Page (`/vault/market`)
**Purpose:** Buy and sell cards via auctions

**Features:**
- Tabbed interface:
  - Active Auctions (all current auctions)
  - My Bids (auctions user has bid on)
  - My Listings (user's active auctions)
- Create auction button (top-right)
- Real-time updates via WebSocket (future)
- MarketBrowser component (from Agent 3)
- CreateAuctionModal component (from Agent 3)

**Integration Points:**
- Uses `MarketBrowser` from Agent 3
- Uses `CreateAuctionModal` from Agent 3

#### 4. Collections Page (`/vault/collections`)
**Purpose:** Manage card collections

**Features:**
- My collections grid with thumbnails
- Create collection modal
- Collection analytics summary:
  - Total collections
  - Total unique cards
  - Most valuable collection
- Public vs Private filter tabs
- Sort options (by date, value, card count)

**Collection Card Display:**
- Thumbnail (first 4 cards)
- Name, description
- Card count, total value
- Visibility status (Public/Private)

#### 5. Collection Detail Page (`/vault/collections/[slug]`)
**Purpose:** View and manage individual collection

**Features:**
- Collection header:
  - Name (editable if owner)
  - Description (editable if owner)
  - Card count, total value
  - Visibility status
- Edit collection modal:
  - Change name/description
  - Toggle visibility
- Delete collection (with confirmation)
- Share button (copy link to clipboard)
- Card grid (uses CardGrid from Agent 1)
- Filters (by rarity, by type)
- Add/remove cards functionality

#### 6. Inventory Page (`/vault/inventory`)
**Purpose:** Manage all owned cards

**Features:**
- All owned cards grid (uses CardGrid from Agent 1)
- Bulk actions toolbar:
  - Select mode toggle
  - Add to Collection (bulk)
  - List for Auction (bulk)
  - Junk (bulk delete)
- Sort controls:
  - By acquisition date
  - By rarity
  - By market value
  - By card name
- Filter controls:
  - By rarity
  - By season
  - By card type
  - By collection
- Duplicate management:
  - "Show only duplicates" toggle
  - Quick junk duplicates button
- Stats display:
  - Total cards count
  - Total inventory value
  - Duplicate count

## Authentication
- All pages wrapped with `AuthenticationGuard`
- Redirects to `/sign-in` if not authenticated
- Uses Clerk for user authentication
- User context from `~/context/auth-context`

## Design System
- **Glass Physics Hierarchy:**
  - Parent: Sidebar, main containers
  - Child: Cards, stats boxes
  - Interactive: Modals, dropdowns
  - Modal: Highest level overlays

- **Color Theming:**
  - Primary: Gold (#F59E0B) for IxCredits, highlights
  - Success: Green for positive values
  - Warning: Orange for streaks, bonuses
  - Error: Red for delete actions
  - Info: Blue for public/global features
  - Rare: Purple for premium/rare items

## Data Flow

### Dashboard
1. User lands on `/vault`
2. Fetches balance, earnings, transactions via tRPC
3. Displays stats and quick actions
4. Can claim daily bonus if available

### Packs
1. User navigates to `/vault/packs`
2. Views available pack types
3. Clicks "Purchase" → Opens PackPurchaseModal (Agent 2)
4. After purchase → Pack added to "Unopened Packs"
5. Clicks "Open Now" → Opens PackOpeningSequence (Agent 2)
6. Cards added to inventory

### Market
1. User navigates to `/vault/market`
2. Views active auctions via MarketBrowser (Agent 3)
3. Can bid on auctions or create new listings
4. WebSocket updates for real-time changes (future)

### Collections
1. User navigates to `/vault/collections`
2. Views existing collections or creates new
3. Clicks collection → Navigate to `/vault/collections/[slug]`
4. Can edit, delete, or share collection
5. Add/remove cards from collection

### Inventory
1. User navigates to `/vault/inventory`
2. Views all owned cards via CardGrid (Agent 1)
3. Can filter, sort, and bulk select
4. Bulk actions: Add to collection, list for auction, junk

## Integration Points

### Agent 1 (UI Components)
- **CardDisplay** - Individual card rendering
- **CardGrid** - Grid layout for multiple cards
- Used in: Collections detail, Inventory

### Agent 2 (Pack System)
- **PackPurchaseModal** - Pack purchase interface
- **PackOpeningSequence** - Pack opening animation
- Used in: Packs page

### Agent 3 (Marketplace)
- **MarketBrowser** - Auction browsing interface
- **CreateAuctionModal** - Auction creation interface
- Used in: Market page

### Phase 1 (Vault Service)
- **vault.ts** router - IxCredits operations
- Endpoints used:
  - `getBalance` - Get user's IxCredits balance
  - `getTodayEarnings` - Today's earnings breakdown
  - `getTransactions` - Transaction history
  - `claimDailyBonus` - Claim daily login bonus
  - `spendCredits` - Spend IxCredits (pack purchases)

## Future Enhancements
1. **Real-time Updates:** WebSocket integration for market
2. **Advanced Filtering:** More granular card filters
3. **Collection Sharing:** Public collection browsing
4. **Trading System:** Direct card trading between players
5. **Achievements:** Card collection milestones
6. **Analytics:** Advanced collection analytics
7. **Mobile App:** PWA for mobile experience

## Development Notes

### TODO Items
All pages have been created with placeholder integration points. When other agents complete their work:

1. **Replace CardGrid placeholders** with actual `CardGrid` component from Agent 1
2. **Replace PackPurchaseModal** with actual component from Agent 2
3. **Replace PackOpeningSequence** with actual component from Agent 2
4. **Replace MarketBrowser** with actual component from Agent 3
5. **Replace CreateAuctionModal** with actual component from Agent 3
6. **Wire useVaultStats** to actual cards API for accurate statistics
7. **Wire useCollections** to actual cards API for collection management

### API Endpoints Needed (from other agents)
- `cards.getUserCards` - Get all cards for user
- `cards.getCardStats` - Get card statistics
- `packs.purchasePack` - Purchase pack
- `packs.openPack` - Open pack and receive cards
- `packs.getUnopenedPacks` - Get user's unopened packs
- `market.getAuctions` - Get marketplace listings
- `market.createAuction` - Create auction
- `market.placeBid` - Bid on auction
- `collections.create` - Create collection
- `collections.update` - Update collection
- `collections.delete` - Delete collection
- `collections.addCards` - Add cards to collection
- `collections.removeCards` - Remove cards from collection

## Testing Checklist
- [ ] All pages load without errors
- [ ] Navigation works between all pages
- [ ] Authentication guard redirects properly
- [ ] IxCredits balance displays correctly
- [ ] Daily bonus claim works
- [ ] Mobile responsive on all pages
- [ ] Glass physics styling applied consistently
- [ ] Loading states display properly
- [ ] Error boundaries catch errors gracefully
