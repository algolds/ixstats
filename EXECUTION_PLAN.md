# EXECUTION READY - IxStats UI Stability Plan
**Status:** Investigation Complete ✓ Ready for Implementation  
**Date:** May 25, 2026  
**Total Issues:** 7  
**Estimated Time to Fix:** 8-10 hours  

---

## 📊 ISSUE BREAKDOWN

| Issue | Category | Severity | Status | Est. Time |
|-------|----------|----------|--------|-----------|
| A1 | MyCountry - Section 1 Blank | HIGH | Investigating | 2-3 hrs |
| A2 | MyCountry - Section 3 Load Error | HIGH | Root Cause Found | 1-2 hrs |
| A3 | Create Nation Button Error | MEDIUM | Investigating | 1-2 hrs |
| **B4** | **Atomic Integration Buttons** | **MEDIUM** | **READY** | **30 min** |
| C5 | Account Creation Error | HIGH | Root Cause Found | 1 hr |
| **C6** | **+New Account Button** | **MEDIUM** | **READY** | **30 min** |
| **D7** | **Map Notifications Error** | **MEDIUM** | **READY** | **30 min** |

**READY FOR IMPLEMENTATION:** B4, C6, D7 (Quick Wins Phase = 1.5 hours)  
**ROOT CAUSE IDENTIFIED:** A2, C5 (Medium Phase = 2-3 hours)  
**IN INVESTIGATION:** A1, A3 (Complex Phase = 3-4 hours)

---

## 🎯 QUICK WINS - PHASE 1 (Ready Now)

### Issue B4: Atomic Integration Status Buttons Not Responding
**File:** [src/app/builder/components/AtomicIntegrationFeedback.tsx](src/app/builder/components/AtomicIntegrationFeedback.tsx)

**Problem:** Lines 262-278 - "Update Builder" and "Configure" buttons don't respond to clicks

**Root Cause:**
```jsx
// Current (BROKEN):
<Button
  size="sm"
  variant="outline"
  onClick={onUpdateGovernmentBuilder}  // ← undefined if not provided
  disabled={!currentGovernmentBuilder}  // ← wrong condition
  className="flex-1"
>
  <Building2 className="mr-1 h-3 w-3" />
  Update Builder
</Button>
```

**Fix Strategy:**
1. Add null check before onClick
2. Disable button if callback unavailable
3. Add proper error handling

**Implementation:**
```jsx
<Button
  size="sm"
  variant="outline"
  onClick={onUpdateGovernmentBuilder}
  disabled={!onUpdateGovernmentBuilder || !currentGovernmentBuilder}
  className="flex-1"
>
  <Building2 className="mr-1 h-3 w-3" />
  Update Builder
</Button>
```

---

### Issue C6: +New Account Button Not Opening Modal
**Files:** 
- [src/components/thinkpages/ThinkPagesAccountHub.tsx](src/components/thinkpages/ThinkPagesAccountHub.tsx) (header button)
- [src/components/thinkpages/EnhancedAccountManager.tsx](src/components/thinkpages/EnhancedAccountManager.tsx) (footer button)

**Problem:** Clicking "+New Account" doesn't open the account creation modal

**Evidence:** Both buttons have proper `onClick` handlers that set `showAccountCreation=true`

**Most Likely Causes (in priority order):**
1. **Modal not rendering** - Check if `AccountCreationModal` component is being rendered as a child
2. **Modal state not updating** - Verify `setShowAccountCreation` is properly connected
3. **Button visibility** - Verify button passes conditional checks (`isOwner`, `accounts.length < 25`)
4. **Event propagation blocked** - Check for `pointer-events: none` on parent

**Verification Steps:**
1. Open browser DevTools
2. Click +New Account button
3. Check Console for errors
4. Check Network tab to see if any API calls made
5. Add temporary console.log to verify onClick fires

**Quick Fix (if modal not rendering):**
- Verify parent component is rendering `<AccountCreationModal />` child
- Check modal visibility CSS/styling

---

### Issue D7: Map Notifications Bell Shows "Error Loading Country Data"
**File:** [src/components/maps/core/MapDynamicIsland.tsx](src/components/maps/core/MapDynamicIsland.tsx)

**Problem:** Clicking bell icon from Map view shows error; disappears when no notifications

**Root Cause:** Missing error boundary around country data fetching

**Current Code (Lines 186-196):**
```jsx
// ISSUE: No error handling!
const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
  enabled: !!user?.id,
});
const countryName = userProfile?.country?.name;

// If query errors, throws unhandled exception
```

**Fix Strategy:**
1. Wrap query in try-catch with fallback
2. Add error boundary around bell button
3. Provide fallback UI if data unavailable

**Implementation Example:**
```jsx
// Add error handling
const { data: userProfile, isError: userProfileError } = api.users.getProfile.useQuery(
  undefined,
  { enabled: !!user?.id }
);

// Use fallback if error or no data
const countryName = userProfile?.country?.name || "Country";

// Disable bell if data unavailable
{user && totalUnread > 0 && !userProfileError && (
  <button onClick={() => router.push(...)} >
    {/* bell content */}
  </button>
)}
```

---

## 📋 PHASE 2 & 3 - DETAILED INVESTIGATIONS

See [INVESTIGATION_REPORT_MAY25.md](INVESTIGATION_REPORT_MAY25.md) for:
- **Issue A2** - Section 3 "Couldn't Load" (lazy-load error handling)
- **Issue C5** - Account Creation Error (mutation error handling)
- **Issue A1** - Section 1 Blank (state persistence debugging)
- **Issue A3** - Create Nation Button (locate + verify duplicate check)

---

## 🚀 IMPLEMENTATION ROADMAP

### Step 1: Quick Wins (1-2 hours)
```bash
# Test environment
bun run dev
# Browser: Open DevTools Console
# Test issues B4, C6, D7 before fixes
# Apply fixes
# Re-test each fix
```

### Step 2: Medium Fixes (2-3 hours)
- Fix A2: Add lazy-load error boundaries
- Fix C5: Improve mutation error handling

### Step 3: Complex Fixes (3-4 hours)
- Fix A1: Debug state persistence
- Fix A3: Locate and fix create nation button

---

## ✅ SUCCESS CRITERIA

After all fixes, verify:
- [ ] Atomic Integration buttons respond to clicks
- [ ] +New Account button opens modal
- [ ] Map notifications bell works without "Error loading country data"
- [ ] Section 3 loads without timeout error
- [ ] Section 1 shows content on tab-switch
- [ ] Account creation completes without errors
- [ ] Create nation button works or shows appropriate error
- [ ] No console errors when testing each feature

---

## 📝 TESTING CHECKLIST

For each issue:
```
[ ] Test on dev server (bun run dev)
[ ] Open browser DevTools Console
[ ] Reproduce original issue
[ ] Apply fix
[ ] Re-test issue - verify it's resolved
[ ] Check for new console errors
[ ] Test related features for regressions
[ ] Document any edge cases found
```

---

## 🔗 REFERENCE FILES

**Documentation:**
- [INVESTIGATION_REPORT_MAY25.md](INVESTIGATION_REPORT_MAY25.md) - Detailed findings

**Source Files (Key):**
- `src/app/builder/components/AtomicIntegrationFeedback.tsx` - B4
- `src/components/thinkpages/ThinkPagesAccountHub.tsx` - C6
- `src/components/thinkpages/EnhancedAccountManager.tsx` - C6
- `src/components/maps/core/MapDynamicIsland.tsx` - D7
- `src/components/thinkpages/AccountCreationModal.tsx` - C5
- `src/components/mycountry/MyCountryRouter.tsx` - A1, A2
- `src/app/builder/components/enhanced/AtomicBuilderPage.tsx` - A1

---

## ⚠️ CRITICAL REMINDERS

1. Use `bun run typecheck` for full typechecking across all sub-projects
2. Use IDE TypeScript checking or `bun run dev` for fast incremental checks
3. Test each fix in isolation before committing
4. Browser console must be checked after each fix
5. Each file edit should be minimal and focused
6. Always include 3-5 lines of context around edits

---

**Status:** ✅ Ready to begin implementation  
**Next Step:** Start with Phase 1 Quick Wins (B4, C6, D7)
