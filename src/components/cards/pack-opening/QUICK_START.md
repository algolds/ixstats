# Pack Opening System - Quick Start Guide

**5-Minute Integration Guide** for IxCards Pack Opening Experience

> **Verified September 2026.** `PackPurchaseModal` and the `pack-opening/index.ts` barrel were removed during dead-code cleanup. Purchase with `api.cardPacks.purchasePack` yourself (as `src/components/vault/sections/marketplace/VaultStoreTab.tsx` does) and render `PackOpeningSequence` from its own file.

---

## Installation (Already Complete)

All components are installed at:
```
/src/components/cards/pack-opening/
```

No additional dependencies needed - uses existing Motion (`motion/react`), tRPC, and Prisma.

---

## Basic Usage

### 1. Import Components

```tsx
import { PackOpeningSequence } from "~/components/cards/pack-opening/PackOpeningSequence";
```

### 2. Add State Management

```tsx
const [selectedPack, setSelectedPack] = useState<PackData | null>(null);
const [openingPackId, setOpeningPackId] = useState<string | null>(null);
const purchase = api.cardPacks.purchasePack.useMutation();
```

### 3. Purchase the Pack

```tsx
<button
  onClick={async () => {
    const res = await purchase.mutateAsync({ packId: selectedPack.id });
    setOpeningPackId(res.userPack.id); // purchasePack returns { success, message, userPack }
  }}
>
  Buy {selectedPack.name} ({selectedPack.priceCredits} IxC)
</button>
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
User taps "Buy" → cardPacks.purchasePack
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

`PackOpeningSequence` automatically calls:

1. **Open Pack**: `api.cardPacks.openPack.mutate({ userPackId })`
2. **Junk quick action**: `api.cards.junkCards.mutate({ ownershipIds })`

Your page is responsible for **Purchase** (`api.cardPacks.purchasePack.mutate({ packId })`) and any balance display (`api.vault.getBalance`).

---

## Optional Assets

### Sounds (Graceful Fallback)
Place in `public/sounds/`:
- `pack-open.mp3`
- `common-reveal.mp3`
- `rare-reveal.mp3`
- `legendary-reveal.mp3`

**Missing files**: System plays silently

### Pack Images (Gradient Fallback)
Artwork comes from `CardPack.artwork`; the seed references `/images/packs/pack_<id>.svg` (e.g. `pack_s1_recruit.svg`) plus optional `_foil.svg` overlays. None are committed — see `public/images/packs/README.md`.

**Empty `artwork`**: Shows a pack-type gradient (a set-but-missing URL renders blank)

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
Edit `src/lib/cards/pack-opening-service.ts`:
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
2. Pack is active (`CardPack.isActive = true`) and pack purchases are enabled (`isPacksEnabled`, not in maintenance mode)
3. Pack isn't sold out (`limitedQuantity`) or over the per-user `purchaseLimit`
4. Pack hasn't expired (`expiresAt`)

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
const res = await purchase.mutateAsync({ packId });
setOpeningPackId(res.userPack.id);
```

### Showing Results
```tsx
// After pack opening completes
onComplete={() => {
  setOpeningPackId(null);
  toast.success("Cards added to collection!");
  router.push("/vault/inventory");
}}
```

---

## Integration Checklist

- [ ] Import `PackOpeningSequence` in the pack store page
- [ ] Add state for selected pack and opening pack
- [ ] Call `cardPacks.purchasePack` and capture `userPack.id`
- [ ] Render PackOpeningSequence in fullscreen overlay
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

See `/src/components/cards/pack-opening/README.md` for a complete integration example, and `src/components/vault/sections/marketplace/VaultStoreTab.tsx` for the production implementation (pack grid, purchase, opening sequence, success/error handling).

---

## Support

**Documentation**:
- `/src/components/cards/pack-opening/README.md` - Full guide
- `/src/types/pack-opening.ts` - Type definitions
- `/src/lib/cards/pack-opening-service.ts` - Sound, haptics, particles

**Code Reference**:
- All components include inline JSDoc comments
- Service layer has detailed method documentation
- Example usage in README.md

---

**That's it! You're ready to integrate pack opening in under 5 minutes.**

Happy pack opening! 🎉
