# IxStats UI Stability Issues - Detailed Investigation Report
**Date:** May 25, 2026  
**Investigator:** GitHub Copilot  
**Status:** In-Progress Investigation

---

## FINDINGS SUMMARY

### ✅ COMPLETED INVESTIGATIONS

#### Issue B4: Atomic Integration Status Buttons Non-Functional
**Status:** ROOT CAUSE IDENTIFIED ✓  
**Severity:** MEDIUM  
**File:** [src/app/builder/components/AtomicIntegrationFeedback.tsx](src/app/builder/components/AtomicIntegrationFeedback.tsx)

**Root Cause Analysis:**
1. **Feedback Item Buttons (WORKING)** - Lines 230-250 show actionable feedback items have proper `onClick` handlers:
   ```jsx
   {feedbackItem.actionable && feedbackItem.actionLabel && (
     <Button
       size="sm"
       variant="outline"
       onClick={() => handleFeedbackAction(feedbackItem)}
       className="mt-2"
     >
       {feedbackItem.actionLabel}
       <ArrowRight className="ml-1 h-3 w-3" />
     </Button>
   )}
   ```

2. **Quick Actions Buttons (ISSUE FOUND)** - Lines 262-278:
   - "Update Builder" button has `onClick={onUpdateGovernmentBuilder}` but callback is optional
   - When `onUpdateGovernmentBuilder` is undefined, button click does nothing silently
   - "Configure" button only closes the expanded state, doesn't navigate or act
   - **Missing error boundary** if callbacks are not provided

**Fix Required:**
- [ ] Add null checks before calling callbacks
- [ ] Provide alternative behavior if callbacks not provided
- [ ] Consider disabling buttons if callbacks unavailable

---

### 🔍 ACTIVE INVESTIGATIONS (In-Progress)

#### Issue A1: MyCountry Editor Section 1 'Foundations' Blank on Tab-Switch
**Status:** INVESTIGATION IN-PROGRESS  
**Severity:** HIGH  
**Files to Review:**
- [src/components/mycountry/MyCountryRouter.tsx](src/components/mycountry/MyCountryRouter.tsx) - Section state management
- [src/app/mycountry/editor/page.tsx](src/app/mycountry/editor/page.tsx) - Editor entry point
- [src/app/builder/components/enhanced/AtomicBuilderPage.tsx](src/app/builder/components/enhanced/AtomicBuilderPage.tsx) - 7-step wizard

**Current Findings:**
- Editor uses `AtomicBuilderPage` component (multi-step wizard, 7 steps)
- "Section 1 Foundations" appears to be Step 1 of the builder
- Issue: When switching between other MyCountry sections (Executive, Diplomacy, etc.) and returning to Overview tab, Step 1 appears blank
- **Hypothesis:** Step state not being preserved or reset when component remounts

**Hypothesis - Root Causes:**
1. **State Not Persisted** - If user navigates away from editor and returns, builder state may reset
2. **Conditional Rendering Issue** - Step 1 might have a conditional that fails on re-render
3. **Data Loading Race Condition** - Data for Step 1 loading but component unmounts before completion
4. **Context Loss** - BuilderStateContext might be unmounting when section changes

**Next Steps:**
- [ ] Check BuilderStateContext provider boundaries
- [ ] Verify step state persistence in localStorage
- [ ] Check for missing error boundary in Step 1 (Foundations)
- [ ] Review lazy loading of step components

---

#### Issue A2: MyCountry Editor Section 3 'Couldn't Load' Error
**Status:** INVESTIGATION IN-PROGRESS  
**Severity:** HIGH  
**Files to Review:**
- [src/components/mycountry/MyCountryRouter.tsx](src/components/mycountry/MyCountryRouter.tsx) - Lazy-loaded sections
- [src/components/mycountry/EnhancedIntelligenceContent.tsx](src/components/mycountry/EnhancedIntelligenceContent.tsx)
- [src/components/mycountry/EnhancedDefenseContent.tsx](src/components/mycountry/EnhancedDefenseContent.tsx)
- [src/components/mycountry/EnhancedMapEditorContent.tsx](src/components/mycountry/EnhancedMapEditorContent.tsx)

**Current Findings:**
- MyCountry uses single-page router pattern
- Rare sections (Intelligence, Defense, Map Editor) are lazy-loaded with `dynamic()`
- **Evidence at lines 51-67:** Lazy imports use `{ loading: () => <SectionSkeleton /> }`
- User reports: "Section 3 shows 'couldn't load' on tab-switch (reload fixes)"

**Hypothesis - Root Causes:**
1. **Lazy Component Timeout** - Dynamic import fails silently, skeleton stays visible
2. **Missing Error Boundary** - No fallback UI if lazy load fails (reload forces fresh import)
3. **Data Fetch Timeout** - Lazy section loads but data fetch never completes
4. **SectionSkeleton Stuck** - Component never transitions from skeleton to content

**Evidence:**
- Reload works → suggests static issue, not data issue
- "Couldn't load" message suggests error UI somewhere
- Only affects "rare sections" → likely lazy-load specific

**Next Steps:**
- [ ] Add `onError` callback to dynamic() imports
- [ ] Verify timeout handling for lazy loads
- [ ] Search for "couldn't load" error message location
- [ ] Check if error boundary wraps lazy sections

---

#### Issue A3: "Create Your Nation" Button Error
**Status:** INVESTIGATION IN-PROGRESS  
**Severity:** MEDIUM  
**Files to Review:**
- [src/components/mycountry/GovernmentStructureDisplay.tsx](src/components/mycountry/GovernmentStructureDisplay.tsx) - Found reference to "Create your nation"
- Search for button location still needed
- Likely in: builder/setup flow, not in MyCountry Editor itself

**Current Findings:**
- Found reference in GovernmentStructureDisplay.tsx line 282
- Message: "Create your nation's government using atomic components or traditional structure."
- **Hypothesis:** Button is in onboarding/setup flow, not in the main Editor
- Error: "possibly because the country exists already" suggests duplicate creation attempt

**Hypothesis - Root Causes:**
1. **No Existence Check** - Button doesn't verify if country already exists before calling mutation
2. **Error Message Not Displayed** - API error (country exists) not shown to user
3. **Button Not Disabled** - Button remains clickable after successful creation
4. **Race Condition** - User clicks button twice, both calls reach API

**Next Steps:**
- [ ] Locate "Create Your Nation" button (may be in onboarding, not main editor)
- [ ] Check for client-side country existence check
- [ ] Review mutation error handling
- [ ] Verify button is disabled after successful creation or error

---

#### Issue C5: Thinkpages "Create New Account" Error
**Status:** INVESTIGATION IN-PROGRESS  
**Severity:** HIGH  
**File:** [src/components/thinkpages/AccountCreationModal.tsx](src/components/thinkpages/AccountCreationModal.tsx)

**Current Findings - Line 225-229 Shows Error Handling:**
```jsx
try {
  const submitData = { ...formData, profileImageUrl: formData.profileImageUrl || undefined };
  const newAccount = await createAccountMutation.mutateAsync({
    ...submitData,
    countryId,
  });
  notify.success("Account created successfully!");
  onAccountCreated(newAccount);
  onClose();
} catch (error: any) {
  notify.error(error.message || "Failed to create account");
}
```

**Hypothesis - Root Causes:**
1. **Mutation Error Not Thrown** - `mutateAsync()` might not throw even on error
2. **Missing onError Handler** - The mutation might have `onError` that interferes
3. **Account Limit Check Failing** - Backend returns 400, but error message not clear
4. **Validation Error** - Form passes validation but backend validation fails

**Evidence at line 213:**
```jsx
const createAccountMutation = api.thinkpages.createAccount.useMutation();
```
- No `onError` or `onSuccess` handlers attached to mutation
- Relies entirely on `mutateAsync()` error throwing

**Next Steps:**
- [ ] Check tRPC endpoint `api.thinkpages.createAccount` for error handling
- [ ] Verify form validation catches all backend validation errors
- [ ] Add explicit onError handler to mutation
- [ ] Check if account limit (25) is being enforced properly
- [ ] Improve error message display

---

#### Issue C6: +New Button Next to Account Switcher Non-Functional
**Status:** INVESTIGATION IN-PROGRESS  
**Severity:** MEDIUM  
**Files:** 
- [src/components/thinkpages/ThinkPagesAccountHub.tsx](src/components/thinkpages/ThinkPagesAccountHub.tsx) - Line 87-93 (header button)
- [src/components/thinkpages/EnhancedAccountManager.tsx](src/components/thinkpages/EnhancedAccountManager.tsx) - Line ~331 (footer button)

**Current Findings - BOTH Buttons Show Proper Event Handlers:**

**Header Button (ThinkPagesAccountHub, lines 87-93):**
```jsx
<Button
  onClick={() => setShowAccountCreation(true)}
  className="gap-1.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700"
>
  <Plus className="h-4 w-4" />
  New Account
</Button>
```

**Footer Button (EnhancedAccountManager, lines ~331-337):**
```jsx
{isOwner && accounts.length < 25 && (
  <Button
    onClick={onCreateAccount}
    variant="outline"
    size="sm"
    className="flex w-full items-center gap-2"
  >
    <Plus className="h-4 w-4" />
    Create New Account ({25 - accounts.length} remaining)
  </Button>
)}
```

**Hypothesis - Root Causes:**
1. **Wrong Button** - User might be clicking a different +New button somewhere
2. **Event Propagation Blocked** - Parent element has `pointer-events: none`
3. **Modal Not Opening** - `setShowAccountCreation(true)` called but modal not visible
4. **Conditional Render** - Button hidden by `isOwner` or `accounts.length < 25` condition

**Evidence:**
- Both buttons have proper onClick handlers
- No obvious styling that would hide them
- Likely a conditional visibility issue or wrong button being clicked

**Next Steps:**
- [ ] Verify which specific button user is clicking
- [ ] Check if AccountCreationModal is actually being rendered
- [ ] Verify modal opening animation (might not be visible)
- [ ] Check for `pointer-events: none` on parent container
- [ ] Add console.log to verify onClick is firing

---

#### Issue D7: Map View Notifications Bell - "Error Loading Country Data"
**Status:** INVESTIGATION IN-PROGRESS  
**Severity:** MEDIUM  
**File:** [src/components/maps/core/MapDynamicIsland.tsx](src/components/maps/core/MapDynamicIsland.tsx)

**Current Findings - Lines 496-530 Show Notifications Bell:**
```jsx
{user && totalUnread > 0 && (
  <button
    onClick={() =>
      router.push(messageUnreadCount > 0 ? "/messages" : "/notifications")
    }
    // ... button styling
  >
    {messageUnreadCount > 0 ? <MessageCircle /> : <Bell />}
    <span>{totalUnread > 99 ? "99+" : totalUnread}</span>
  </button>
)}
```

**Current Findings - Data Sources:**
- `useCountryData()` - Line 196: `const { data: userProfile } = api.users.getProfile.useQuery()`
- `useNotificationStore()` - Line 187: `const { stats: notificationStats } = useNotificationStore()`
- `useMessageUnreadCount()` - Line 190: `const { totalUnread: messageUnreadCount } = useMessageUnreadCount()`

**Hypothesis - Root Causes:**
1. **Missing Error Boundary** - userProfile query error not caught, throws unhandled error
2. **Race Condition** - Notification count changes, triggers navigation before data loads
3. **Incorrect Page Route** - Clicking bell navigates to `/notifications` which has error
4. **Country Data Hook Error** - useCountryData() or userProfile throws error not caught
5. **Wrong Error Location** - Error might actually be on `/notifications` page, not bell click

**Evidence:**
- Error: "Error loading country data" specifically mentions country data
- Disappears when no notifications → suggests notification-dependent issue
- Map-view specific → might be integration issue between map and notifications

**Next Steps:**
- [ ] Add try-catch around userProfile query
- [ ] Add error boundary around bell button
- [ ] Check `/notifications` page for errors
- [ ] Verify CountryDataProvider context is available in map component
- [ ] Add console.log to track error

---

## IMPLEMENTATION PRIORITY

### Tier 1 - QUICK WINS (1-2 hours)
1. **Issue B4** - Atomic Integration buttons (add null checks, disable if no callback)
2. **Issue C6** - +New button (verify modal opening, check conditionals)
3. **Issue D7** - Map notifications (add error boundary, catch userProfile errors)

### Tier 2 - MEDIUM (2-3 hours)
4. **Issue C5** - Account creation error (improve error handling, check validation)
5. **Issue A2** - Section 3 load error (add lazy-load error handling)

### Tier 3 - COMPLEX (2-3 hours)
6. **Issue A1** - Section 1 blank (debug state persistence, context boundaries)
7. **Issue A3** - Create nation button (locate and fix duplicate check)

---

## TESTING STRATEGY

For each fix:
1. **Before Test** - Reproduce issue (browser DevTools open to catch errors)
2. **After Test** - Verify fix resolves issue
3. **Regression Test** - Check related components still work
4. **Console Check** - Verify no new errors introduced

---

## NOTES FOR DEVELOPER

- **DO NOT** run global `tsc --noEmit` - will exhaust 4GB Node heap
- Use IDE TypeScript checking or `bun run dev` for incremental checks
- Test with `bun run dev` and verify via browser before committing
- Check browser DevTools Console for unhandled errors
- Each fix should be isolated and tested independently
