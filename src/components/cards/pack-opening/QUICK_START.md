# Pack Opening System - Quick Start Guide

**5-Minute Integration Guide** for IxCards Pack Opening Experience

---

## Installation (Already Complete)

All components are installed at:
```
/src/components/cards/pack-opening/
```

No additional dependencies needed - uses existing Framer Motion, tRPC, and Prisma.

---

## Basic Usage

### 1. Import Components

```tsx
import {
  PackPurchaseModal,
  PackOpeningSequence
} from "~/components/cards/pack-opening";
```

### 2. Add State Management

```tsx
const [selectedPack, setSelectedPack] = useState<PackData | null>(null);
const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
const [openingPackId, setOpeningPackId] = useState<string | null>(null);
```

### 3. Render Purchase Modal

```tsx
<PackPurchaseModal
  packId={selectedPack.id}
  packType={selectedPack.packType}
  packName={selectedPack.name}
  priceCredits={selectedPack.priceCredits}
  cardCount={selectedPack.cardCount}
  isOpen={isPurchaseModalOpen}
  onPurchase={(userPackId) => {
    setIsPurchaseModalOpen(false);
    setOpeningPackId(userPackId);
  }}
  onCancel={() => setIsPurchaseModalOpen(false)}
/>
```

### 4. Render Pack Opening (Fullscreen)

```tsx
{openingPackId && (
  <div className="fixed inset-0 z-50 bg-black">
    <PackOpeningSequence
      userPackId={openingPackId}
      packType={selectedPack.packType}
      onComplete={() => setOpeningPackId(null)}
      onCancel={() => setOpeningPackId(null)}
    />
  </div>
)}
```

**That's it!** The system handles everything else automatically.

---

## Component Props Reference

### PackPurchaseModal

```typescript
{
  packId: string              // CardPack.id from database
  packType: PackType          // BASIC, PREMIUM, ELITE, etc.
  packName: string            // Display name
  packDescription?: string    // Optional description
  packArtwork?: string        // Optional image URL
  priceCredits: number        // Price in IxCredits
  cardCount: number           // Number of cards in pack
  isOpen: boolean             // Modal visibility
  onPurchase: (userPackId: string) => void  // Called after purchase
  onCancel: () => void        // Called on close
}
```

### PackOpeningSequence

```typescript
{
  userPackId: string          // UserPack.id from purchase
  packType: PackType          // Pack type for visuals
  packArtwork?: string        // Optional custom artwork
  onComplete: () => void      // Called when sequence finishes
  onCancel: () => void        // Called if user cancels
}
```

---

## Animation Timeline

```
User taps "Purchase" → PackPurchaseModal
  ↓
Purchase succeeds → PackOpeningSequence starts
  ↓
Stage 1: Pack Reveal (2s) → User taps pack
  ↓
Stage 2: Explosion (0.8s) → Auto-advance
  ↓
Stage 3: Card Reveal (~4s) → Auto-advance
  ↓
Stage 4: Quick Actions → User clicks "Done"
  ↓
onComplete() called
```

**Total Time**: ~7 seconds auto + user interaction time

---

## API Calls (Automatic)

The system automatically calls:

1. **Purchase**: `api.cardPacks.purchasePack.mutate({ packId })`
2. **Balance Check**: `api.vault.getVaultBalance.query()`
3. **Open Pack**: `api.cardPacks.openPack.mutate({ userPackId })`

No manual API calls needed!

---

## Optional Assets

### Sounds (Graceful Fallback)
Place in `public/sounds/`:
- `pack-open.mp3`
- `common-reveal.mp3`
- `rare-reveal.mp3`
- `legendary-reveal.mp3`

**Missing files**: System plays silently

### Pack Images (Text Fallback)
Place in `public/images/packs/`:
- `basic-pack.png`
- `premium-pack.png`
- `elite-pack.png`
- `themed-pack.png`
- `seasonal-pack.png`
- `event-pack.png`

**Missing images**: Shows pack type text

---

## Customization

### Pack Type Colors
Edit in `Stage1_PackReveal.tsx`:
```typescript
const PACK_GLOW_COLORS: Record<PackType, string> = {
  BASIC: "rgba(59, 130, 246, 0.4)",    // Blue
  PREMIUM: "rgba(139, 92, 246, 0.4)",  // Violet
  ELITE: "rgba(236, 72, 153, 0.4)",    // Pink
  // ... add more
};
```

### Animation Duration
Edit stage component files:
```typescript
// Stage1_PackReveal.tsx
transition={{ duration: 2 }}  // Change from 2s

// Stage2_PackExplosion.tsx
setTimeout(onComplete, 800);  // Change from 800ms

// Stage3_CardReveal.tsx
revealedIndex === -1 ? 500 : 800  // First card / stagger delay
```

### Particle Count
Edit `pack-opening-service.ts`:
```typescript
export function getOptimalParticleCount(): number {
  return isMobileDevice() ? 25 : 50;  // Adjust counts
}
```

---

## Troubleshooting

### Issue: Pack won't open
**Check**:
1. `userPackId` is valid UserPack ID
2. Pack hasn't been opened already (`isOpened = false`)
3. User owns the pack (`userId` matches)

**Console**: Check for API errors

### Issue: No sound
**Solution**: Sounds are optional - system works silently

### Issue: Laggy animations
**Solution**:
- Reduce particle count in service
- Check browser GPU acceleration
- Test on different device

### Issue: Purchase fails
**Check**:
1. User has sufficient IxCredits
2. Pack is available (`isAvailable = true`)
3. Pack isn't sold out
4. Pack hasn't expired

---

## Performance Tips

### Desktop Optimization
```tsx
// Already optimized with:
- 50 particles
- GPU acceleration
- React.memo on all components
- Sound preloading
```

### Mobile Optimization
```tsx
// Auto-detected with:
- 25 particles (reduced)
- Haptic feedback
- Touch-optimized
- Responsive design
```

### Further Optimization
```typescript
// Reduce particles even more
export function getOptimalParticleCount(): number {
  return isMobileDevice() ? 15 : 30;  // More aggressive
}
```

---

## Common Patterns

### Opening From Pack List
```tsx
// In unopened packs list
<button onClick={() => {
  setOpeningPackId(userPack.id);
}}>
  Open Pack
</button>
```

### Opening After Purchase
```tsx
// After successful purchase
onPurchase={(userPackId) => {
  setIsPurchaseModalOpen(false);
  setOpeningPackId(userPackId);
}}
```

### Showing Results
```tsx
// After pack opening completes
onComplete={() => {
  setOpeningPackId(null);
  toast.success("Cards added to collection!");
  router.push("/myvault/collection");
}}
```

---

## Integration Checklist

- [ ] Import components in pack store page
- [ ] Add state for selected pack and opening pack
- [ ] Render PackPurchaseModal with pack data
- [ ] Render PackOpeningSequence in fullscreen overlay
- [ ] Handle onPurchase callback
- [ ] Handle onComplete callback
- [ ] (Optional) Add sound files to public/sounds/
- [ ] (Optional) Add pack images to public/images/packs/
- [ ] Test purchase flow
- [ ] Test pack opening sequence
- [ ] Test on mobile device

---

## Next Steps

1. **Basic Integration**: Use example above to add to pack store
2. **Add Assets**: Drop in sound/image files (optional)
3. **Test Flow**: Purchase → Open → Complete
4. **Customize**: Adjust colors, durations, particles
5. **Polish**: Add success toasts, navigation, etc.

---

## Full Example Page

See `/src/components/cards/pack-opening/README.md` for complete integration example with:
- Pack store grid
- Purchase modal
- Opening sequence
- Success handling
- Error handling

---

## Support

**Documentation**:
- `/src/components/cards/pack-opening/README.md` - Full guide
- `/PACK_OPENING_IMPLEMENTATION.md` - Technical specs
- `/src/types/pack-opening.ts` - Type definitions

**Code Reference**:
- All components include inline JSDoc comments
- Service layer has detailed method documentation
- Example usage in README.md

---

**That's it! You're ready to integrate pack opening in under 5 minutes.**

Happy pack opening! 🎉
