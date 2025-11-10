# Autosave User Guide

## What is Autosave?

Autosave is an intelligent data protection system that automatically saves your progress while building your nation in IxStats. It works quietly in the background, ensuring that your hard work is never lost due to unexpected browser crashes, network issues, or accidental navigation.

### How Autosave Works

**Automatic Saving**: Autosave monitors your changes across all builder sections (National Identity, Government, Tax System, Economy). When you make edits, it waits 15 seconds after you stop typing or interacting before triggering a save. This batching approach prevents excessive database writes and provides a smooth editing experience.

**Manual Saving**: In addition to automatic saves, you can click the "Save Progress" button at any time to immediately persist your current changes. This is useful before navigating away, closing the browser, or after making critical changes you want to ensure are saved right away.

**What Data is Saved**: Autosave captures all changes across four major builder sections:
- **National Identity**: Country names, symbols, flag metadata, culture details, geography, demographics
- **Government Structure**: Atomic components, traditional departments, budgets, leadership, effectiveness scores
- **Tax System**: Income brackets, tax rates, categories, deductions, fiscal policy settings
- **Economic Configuration**: Sector composition, labor market data, population demographics, economic tiers

**When Autosave Triggers**:
- 15 seconds after you stop making changes (debounced for efficiency)
- Immediately when you click "Save Progress" button
- Before builder unmounts (when navigating away from the page)
- When entering edit mode (loads existing data automatically)

### Automatic vs Manual Saving

| Feature | Automatic Save | Manual Save |
|---------|---------------|-------------|
| **Trigger** | 15 seconds after last change | Immediate on button click |
| **User Action** | None required | Click "Save Progress" button |
| **Use Case** | Continuous protection during editing | Critical changes, before navigation |
| **Visual Feedback** | Status indicator updates | Immediate confirmation toast |
| **Network Required** | Yes (falls back to localStorage) | Yes (falls back to localStorage) |

**Best Practice**: Let automatic saves handle routine edits, but use manual saves before major actions like closing the browser or switching to another application.

## Using Autosave in the Builder

### Visual Indicators

The autosave system provides clear, real-time feedback about your save status through visual indicators located in the builder header:

**Status Messages**:
- **"Saving..."**: Appears when autosave is actively writing data to the database. You'll see this briefly during both automatic and manual saves.
- **"Last saved at [timestamp]"**: Confirms successful save with precise timestamp (e.g., "Last saved at 2:47:32 PM"). This updates after each successful save operation.
- **"Save failed"**: Indicates a save operation encountered an error. The system will automatically retry, but you can also trigger a manual retry.
- **"Unsaved changes"**: Appears when you've made edits that haven't been saved yet (debounce delay hasn't elapsed).

**Checkmark Animation**:
When a save completes successfully, you'll see a smooth green checkmark animation next to the status text. This provides immediate visual confirmation that your data is safe.

**Color Coding**:
- **Blue/Gray**: Normal state, no pending changes
- **Yellow**: Saving in progress
- **Green**: Save successful with checkmark
- **Red**: Save failed, retry needed

**Example Flow**:
1. You type a new country name
2. Status shows "Unsaved changes" (gray)
3. 15 seconds pass with no further edits
4. Status changes to "Saving..." (yellow)
5. After 1-2 seconds: "Last saved at 2:47:32 PM" with green checkmark
6. After 3 seconds: Checkmark fades, timestamp remains

### Manual "Save Progress" Button

The "Save Progress" button provides immediate control over when your data is persisted. Located prominently in the builder header, this button bypasses the 15-second debounce delay and saves immediately.

**When to Use Manual Save**:
- **Before Navigating**: Click before closing the tab, switching pages, or leaving the builder
- **After Critical Changes**: When you've made important edits you want to ensure are saved immediately
- **Slow Internet**: If your connection is unstable, manually trigger saves at safe points
- **Before Browser Refresh**: Always save manually before hitting F5 or refreshing the page
- **Multiple Rapid Changes**: If you're making many quick edits and want to checkpoint your work

**How to Use**:
1. Make your desired changes in any builder section
2. Locate the "Save Progress" button in the builder header
3. Click the button once
4. Wait for the "Last saved at..." confirmation
5. Look for the green checkmark animation indicating success

**Button States**:
- **Enabled**: Clickable when there are pending changes or when you want to force a save
- **Disabled**: During active save operations (prevents duplicate saves)
- **Loading**: Shows spinner icon while save is in progress

**Difference from Automatic Save**:
- **Timing**: Immediate vs 15-second delay
- **User Control**: Explicit action vs passive monitoring
- **Use Case**: Critical checkpoints vs continuous protection
- **Network Retry**: Manual saves provide immediate error feedback, allowing you to retry if needed

**Pro Tip**: Develop a habit of clicking "Save Progress" before any major browser action (closing tab, refreshing, navigating away). This ensures your work is always protected.

### Edit Mode Data Loading

When you return to edit an existing country, the autosave system automatically loads your previously saved data without any manual intervention. This seamless experience ensures you can pick up exactly where you left off.

**How Edit Mode Loading Works**:

1. **Entry Detection**: When you navigate to the builder with an existing country ID, the system detects edit mode automatically
2. **Data Fetching**: Autosave hooks query the database for your most recent saved data across all sections
3. **State Hydration**: Retrieved data populates the builder forms, restoring all your previous values
4. **Ready State**: Once loaded, the status indicator shows "Last saved at [timestamp]" with your most recent save time

**What Gets Loaded**:
- **National Identity**: All country names (short, formal, official), flag URLs, symbols, culture, geography
- **Government**: All selected atomic/traditional components, budgets, department configs, leadership
- **Tax System**: Income brackets, rates, categories, deductions, all fiscal settings
- **Economy**: Sector data, demographics, labor market, population figures, economic tier selections

**Visual Loading States**:
- **Initial Load**: Brief loading spinner while data fetches from database
- **Hydration**: Forms populate with your saved values
- **Ready**: "Last saved at..." indicator confirms data is loaded and ready to edit
- **No Data**: If no autosave exists, forms remain empty (new country creation flow)

**Edit Mode Indicators**:
- Page title shows "Edit Country: [Your Country Name]"
- Breadcrumb navigation reflects edit mode context
- All forms pre-populated with existing data
- Autosave timestamp shows when you last saved this country

**Example Edit Flow**:
1. Navigate to "/builder?countryId=abc123"
2. System detects edit mode, shows loading spinner
3. Data fetches from database (National Identity, Government, Tax, Economy)
4. Forms populate with your saved values
5. Status shows "Last saved at 11/09/2025, 2:47:32 PM"
6. You continue editing from where you left off
7. New changes trigger autosave with updated timestamps

**Conflict Prevention**:
If you have the same country open in multiple tabs, the autosave system coordinates saves to prevent conflicts. The most recent save always wins, and you'll see updated timestamps across all tabs when saves occur.

**Data Freshness**:
Edit mode always loads the most recent autosave data from the database, ensuring you're working with the latest version. If you saved from another device, those changes will be loaded when you open the builder again.

## Understanding Autosave Status

### Success Indicators

Autosave provides multiple layers of visual feedback to confirm your data has been successfully saved:

**Green Checkmark Animation**:
The primary success indicator is a smooth, animated green checkmark that appears next to the save status text. This checkmark:
- Fades in over 300ms when save completes
- Remains visible for 3 seconds
- Fades out gradually
- Provides immediate visual confirmation without being distracting

**Timestamp Updates**:
After each successful save, the status text updates to show the exact time of the save:
- Format: "Last saved at 2:47:32 PM" (12-hour format)
- Updates in real-time after each save operation
- Persists across page sessions (loaded from database on return)
- Allows you to verify when your most recent save occurred

**Success Toast Notifications**:
For manual "Save Progress" button clicks, you'll see a toast notification at the bottom-right of the screen:
- Message: "Progress saved successfully!"
- Duration: 3 seconds
- Green background with checkmark icon
- Dismissible by clicking the X
- Non-blocking (doesn't interrupt your work)

**Status Text Color**:
The status text changes color to indicate successful save:
- Green highlight on "Last saved at..." text
- Returns to neutral gray after checkmark fades
- Provides subtle confirmation without being jarring

**Network Request Completion**:
Behind the scenes, you can verify saves in browser DevTools:
- Open Network tab in DevTools
- Look for successful 200 responses to autosave API calls
- Verify payload contains your data
- Confirm response includes success status

**Example Success Flow**:
1. You edit a country name
2. 15 seconds pass (debounce delay)
3. Status changes to "Saving..." (yellow)
4. API request completes successfully
5. Green checkmark fades in next to status text
6. Status updates to "Last saved at 2:47:32 PM"
7. Checkmark remains for 3 seconds, then fades out
8. Timestamp remains visible

**What Success Means**:
- Your data has been written to the database
- Changes are persisted and safe
- You can safely navigate away or close the browser
- Data is available on other devices after login
- No action required on your part

### Error Handling and Recovery

When autosave encounters issues, the system provides clear feedback and automatic recovery mechanisms:

**"Save Failed" Indicator**:
If a save operation fails, you'll see:
- Red "Save failed" text in the status area
- Error icon (⚠️) next to the status text
- Detailed error toast notification
- Automatic retry countdown timer

**Common Error Causes**:
- **Network Timeout**: Internet connection dropped during save
- **Server Error**: Backend API returned 500/503 error
- **Authentication Expired**: Clerk session expired, requires re-login
- **Database Lock**: Concurrent save operations conflicted
- **Validation Error**: Data failed backend validation checks
- **Rate Limiting**: Too many save requests in short time window

**Automatic Retry Behavior**:
The autosave system implements exponential backoff retry:
1. **First Retry**: Waits 2 seconds, then retries automatically
2. **Second Retry**: Waits 4 seconds, then retries
3. **Third Retry**: Waits 8 seconds, then retries
4. **Max Retries**: After 3 failed attempts, stops and alerts user

**Retry Indicators**:
- Status shows "Retrying save... (attempt 1 of 3)"
- Countdown timer displays seconds until next retry
- Spinner animation indicates active retry in progress
- Toast notifications update with retry status

**localStorage Fallback**:
If network saves fail, data is automatically saved to localStorage:
- Prevents data loss during network outages
- Data persists in browser storage
- Syncs to database when connection restored
- Status shows "Saved locally (pending sync)"

**Manual Recovery Steps**:

1. **Check Internet Connection**:
   - Verify you're connected to the internet
   - Test other websites to confirm connectivity
   - Check browser network status indicator

2. **Click "Save Progress" Button**:
   - Manually trigger a new save attempt
   - Bypasses automatic retry delays
   - Provides immediate feedback on success/failure

3. **Check Browser Console**:
   - Press F12 to open DevTools
   - Navigate to Console tab
   - Look for red error messages
   - Copy error details for support ticket

4. **Verify Authentication**:
   - Check if you're still logged in (Clerk session)
   - Try refreshing the page to restore session
   - Re-login if session expired

5. **Copy Your Changes**:
   - If saves continue to fail, copy your text changes to a document
   - Take screenshots of complex configurations
   - Contact support while preserving your work

**Error Toast Details**:
Failed save toasts include:
- Error type (Network, Server, Validation, etc.)
- Specific error message from API
- Retry status and countdown
- "Dismiss" and "Retry Now" action buttons

**What to Do After Errors**:
- **Transient Errors**: Wait for automatic retry, no action needed
- **Persistent Errors**: Use manual "Save Progress" button to retry
- **Authentication Errors**: Refresh page or re-login
- **Validation Errors**: Review your data for invalid values
- **Network Errors**: Check connection, wait for recovery
- **Server Errors**: Contact support with error details

**Data Safety During Errors**:
Even during save failures, your data is protected:
- Changes remain in React state (not lost)
- localStorage backup preserves data
- You can continue editing while retries happen
- Manual save button always available

**Recovery Success Indicators**:
When recovery succeeds after errors:
- "Save failed" changes to "Last saved at..."
- Green checkmark animation appears
- Success toast confirms recovery
- Timestamp updates to current time
- localStorage data syncs to database

### Conflict Resolution

Autosave implements intelligent conflict resolution to handle scenarios where the same country is being edited in multiple locations:

**How Conflicts Occur**:
- Opening the same country in multiple browser tabs
- Editing from multiple devices simultaneously
- Network delays causing out-of-order saves
- Browser back/forward navigation with cached state

**Conflict Prevention Strategies**:

1. **Last Write Wins**:
   - The most recent save timestamp always takes precedence
   - Older saves are rejected at the API level
   - Database uses timestamps to enforce order

2. **Tab Coordination**:
   - Browser tabs communicate via localStorage events
   - When one tab saves, others receive update notifications
   - Status indicators sync across tabs automatically

3. **Optimistic Updates**:
   - UI updates immediately (optimistic)
   - If save fails, UI reverts to last known good state
   - Prevents frustrating delays during typing

**What You'll See During Conflicts**:

**Minor Conflicts (Handled Automatically)**:
- No visible indication (handled silently)
- Latest save wins without interruption
- Status continues showing "Last saved at..."

**Major Conflicts (Requires Attention)**:
- Toast notification: "Your changes conflict with recent updates"
- Option to "Keep Your Changes" or "Load Latest Version"
- Status shows "Conflict detected - action required"
- Manual resolution required before continuing

**Conflict Resolution Dialog**:
If a major conflict occurs, you'll see:
```
Conflict Detected

Your changes conflict with updates made in another tab/device.

Your Version (Current):
- Country Name: "Republic of Ixonia"
- Government Type: Parliamentary Democracy
- Last Modified: 2:45:30 PM

Latest Version (Server):
- Country Name: "Democratic Republic of Ixonia"
- Government Type: Presidential Democracy
- Last Modified: 2:46:15 PM

[ Keep My Changes ]  [ Load Latest Version ]
```

**Resolution Options**:

1. **Keep My Changes**:
   - Overwrites server data with your current values
   - Your timestamp becomes the new "latest"
   - Other tabs/devices will load your version on next refresh
   - Use when you're certain your changes are correct

2. **Load Latest Version**:
   - Discards your current changes
   - Loads the most recent server data
   - Your local state updates to match server
   - Use when you want to incorporate others' changes

3. **Cancel and Review**:
   - Closes dialog without resolving conflict
   - Allows you to review both versions
   - Can manually merge changes if needed
   - Save remains blocked until resolved

**Multi-Tab Scenario**:
```
Timeline:
1. Tab A: Edit country name to "Ixonia Republic"
2. Tab B: Edit country name to "Republic of Ixonia"
3. Tab A: Autosave triggers (2:46:00 PM)
4. Tab B: Autosave triggers (2:46:30 PM)
5. Result: Tab B's save wins (newer timestamp)
6. Tab A: Receives update notification, shows conflict dialog
7. User chooses "Load Latest Version"
8. Tab A: Country name updates to "Republic of Ixonia"
```

**Best Practices to Avoid Conflicts**:
- Edit from one tab/device at a time
- Close unused builder tabs when done editing
- Use manual "Save Progress" before switching tabs
- Wait for "Last saved at..." confirmation before switching devices
- If editing from multiple locations, always load latest first

**Technical Details**:
- Conflicts detected via timestamp comparison (server vs client)
- localStorage events propagate saves across tabs
- React state updates trigger re-renders with latest data
- API enforces last-write-wins at database level
- Optimistic UI updates revert on conflict detection

**When Conflicts Can't Be Resolved**:
If conflicts persist or you're unsure how to proceed:
1. Take screenshots of your current data
2. Copy text values to a document
3. Reload the page to get latest server state
4. Contact support with conflict details
5. Manually re-apply your changes if needed

## Best Practices

### When to Use Manual Save

While autosave provides continuous protection, certain situations benefit from manually clicking the "Save Progress" button:

**Before Navigating Away from Builder**:
- Always click "Save Progress" before closing the browser tab
- Save manually before clicking links that navigate to other pages
- Use manual save before pressing browser back button
- Save before switching to another application (Alt+Tab / Cmd+Tab)
- **Why**: Ensures all pending changes are persisted before the builder unmounts

**After Making Critical Changes**:
- Government component selections that affect multiple systems
- Tax bracket configurations that impact economic calculations
- National identity changes (country name, flag, symbols)
- Economic sector data that feeds into GDP calculations
- **Why**: Critical changes warrant immediate confirmation rather than waiting for debounce

**When Experiencing Slow Internet**:
- Save manually at logical checkpoints (after completing each section)
- Don't rely solely on automatic saves if your connection is unstable
- Look for "Saved locally (pending sync)" status and wait for database sync
- Use manual saves to test if your connection is working
- **Why**: Slow connections may timeout automatic saves; manual saves provide immediate feedback

**Before Browser Refresh**:
- Always save before pressing F5 or Ctrl+R / Cmd+R
- Save before using "Hard Refresh" (Ctrl+Shift+R)
- Use manual save if you need to refresh to fix UI issues
- **Why**: Browser refresh may interrupt in-progress autosaves

**After Completing Major Sections**:
- Save after finishing National Identity section
- Save after configuring all government components
- Save after setting up complete tax system
- Save after entering all economic sector data
- **Why**: Provides psychological confirmation and logical checkpoints

**When You See "Unsaved Changes" for Extended Period**:
- If status shows "Unsaved changes" for more than 30 seconds
- When debounce seems stuck (you stopped editing but save hasn't triggered)
- If you're unsure whether autosave is working properly
- **Why**: Manual save forces immediate persistence and confirms system is working

**Before Logging Out**:
- Always save before clicking logout button
- Save before Clerk session expires (after 30+ minutes of inactivity)
- **Why**: Prevents data loss if session ends before autosave completes

**During Long Editing Sessions**:
- Every 15-20 minutes during extended work
- After completing complex multi-field configurations
- When taking breaks from editing
- **Why**: Regular manual saves provide redundancy beyond automatic saves

**When Making Experimental Changes**:
- Save before trying different government configurations to compare
- Create checkpoints before testing different tax bracket structures
- Save known-good states before experimenting
- **Why**: Allows you to revert to saved state if experiments don't work out

**If You Notice Performance Issues**:
- Save manually if browser becomes slow or unresponsive
- Use manual save if you see lag or freezing
- Save before performing actions that might cause issues
- **Why**: Performance issues may interfere with automatic save triggers

**Pro Tips**:
- Develop muscle memory: Ctrl+S / Cmd+S triggers "Save Progress" button (keyboard shortcut)
- Save early, save often - manual saves don't hurt and provide peace of mind
- Watch for green checkmark confirmation after each manual save
- If manual save fails, address the error before continuing major edits

### Browser Compatibility

Autosave is designed to work seamlessly across all modern browsers. Here's what you need to know:

**Fully Supported Browsers**:
- **Google Chrome**: Version 90+ (recommended for best performance)
- **Mozilla Firefox**: Version 88+
- **Apple Safari**: Version 14+
- **Microsoft Edge**: Version 90+ (Chromium-based)
- **Brave Browser**: Version 1.25+
- **Opera**: Version 76+

**Required Browser Features**:
- **JavaScript**: Must be enabled (autosave relies on React and tRPC)
- **localStorage**: Required for offline fallback and tab coordination
- **Cookies**: Needed for Clerk authentication session
- **Modern ECMAScript**: ES2020+ support (async/await, optional chaining)
- **Fetch API**: For network requests to backend APIs

**Checking Browser Compatibility**:

1. **JavaScript Enabled**:
   - Visit browser settings
   - Navigate to Privacy/Security section
   - Ensure JavaScript is not blocked for ixstats.ixwiki.com
   - If disabled, you'll see a warning: "JavaScript required for autosave"

2. **localStorage Available**:
   - Open browser DevTools (F12)
   - Navigate to Application/Storage tab
   - Check "Local Storage" section
   - Should see entries for ixstats.ixwiki.com
   - If unavailable, you'll see: "localStorage blocked - offline save disabled"

3. **Cookies Enabled**:
   - Visit browser settings
   - Navigate to Privacy section
   - Ensure cookies are allowed (at least for ixwiki.com)
   - Clerk authentication requires first-party cookies

**Browser-Specific Notes**:

**Chrome/Edge (Chromium)**:
- Best performance due to V8 JavaScript engine optimization
- Excellent DevTools for debugging autosave issues
- Service workers supported for potential future offline enhancements

**Firefox**:
- Strong privacy features may block third-party APIs
- Enhanced Tracking Protection may interfere with external APIs
- Add ixwiki.com to exceptions if autosave fails

**Safari**:
- localStorage may be cleared more aggressively on iOS/iPadOS
- Private browsing mode disables localStorage completely
- iCloud tab sync may cause confusion with multiple devices

**Mobile Browsers**:
- **Chrome Mobile (Android)**: Fully supported
- **Safari Mobile (iOS/iPadOS)**: Fully supported
- **Firefox Mobile**: Fully supported
- **Samsung Internet**: Supported (Chromium-based)

**Unsupported/Deprecated Browsers**:
- Internet Explorer 11 and below (not supported)
- Legacy Edge (EdgeHTML, pre-Chromium)
- Chrome/Firefox versions older than 2 years
- Opera Mini (limited JavaScript support)

**Troubleshooting Browser Issues**:

**"Autosave not working" in Your Browser**:
1. Clear browser cache and cookies
2. Disable browser extensions (especially ad blockers)
3. Check if JavaScript is enabled
4. Verify localStorage is not blocked
5. Try incognito/private mode to rule out extensions
6. Update browser to latest version

**localStorage Blocked**:
- Check browser privacy settings
- Add ixwiki.com to allowed sites
- Disable "Block third-party cookies" for this site
- Exit private/incognito mode

**Network Request Failures**:
- Disable VPN temporarily to test
- Check firewall settings
- Verify antivirus isn't blocking requests
- Try different network (mobile hotspot vs WiFi)

**Testing Your Browser**:
Visit the builder and check:
- [ ] Status indicator appears in header
- [ ] "Saving..." appears after 15 seconds of edits
- [ ] "Last saved at..." appears after save completes
- [ ] Green checkmark animation plays
- [ ] Manual "Save Progress" button is clickable
- [ ] DevTools console shows no errors (F12)

**Recommended Browser Setup**:
- Use latest Chrome/Edge for optimal experience
- Keep browser updated to latest stable version
- Enable JavaScript and localStorage
- Allow cookies for ixwiki.com
- Disable aggressive content blockers on this site

**Future Compatibility**:
- Progressive Web App (PWA) support planned
- Service worker offline caching (roadmap)
- WebSocket real-time sync (future enhancement)
- IndexedDB migration from localStorage (under consideration)

### Offline Behavior

Autosave is designed to handle network interruptions gracefully, ensuring your work is never lost even when your internet connection drops:

**How Offline Mode Works**:

1. **Network Failure Detection**:
   - Autosave monitors network requests for failures
   - Detects timeouts, connection errors, and server unavailability
   - Triggers offline fallback automatically

2. **localStorage Backup**:
   - When database save fails, data saves to localStorage immediately
   - Stores complete builder state (National Identity, Government, Tax, Economy)
   - Persists across browser sessions (survives refresh/close)
   - Independent of network availability

3. **Offline Status Indicators**:
   - Status shows "Saved locally (pending sync)"
   - Yellow warning icon indicates offline state
   - Toast notification: "No connection - changes saved locally"
   - Manual save button shows offline mode status

4. **Automatic Sync on Reconnection**:
   - Continuously monitors for network restoration
   - Automatically syncs localStorage data to database when online
   - Status updates to "Synced successfully" with green checkmark
   - Clears localStorage backup after successful database save

**What's Saved Offline**:

All builder data is preserved in localStorage during offline periods:
- **National Identity**: Country names, symbols, flag URLs, culture, geography
- **Government**: Selected components, budgets, departments, leadership
- **Tax System**: Brackets, rates, categories, deductions, fiscal settings
- **Economy**: Sectors, demographics, labor market, population data

**Visual Indicators During Offline Mode**:

**Status Text**:
```
"Saved locally (pending sync)" - Data in localStorage, waiting for connection
"Syncing..." - Connection restored, uploading to database
"Synced successfully" - Data now in database, localStorage cleared
```

**Toast Notifications**:
- **Lost Connection**: "Connection lost - saving locally"
- **Saved Offline**: "Changes saved to browser storage"
- **Reconnected**: "Connection restored - syncing data..."
- **Sync Complete**: "All changes synced to database"

**Manual Save Button States**:
- **Offline**: Button shows "Save Locally" (saves to localStorage)
- **Online**: Button shows "Save Progress" (saves to database)
- **Syncing**: Button disabled, shows spinner

**Offline Workflow Example**:

```
Timeline:
1. [Online] You're editing your country's government structure
2. [Online] Autosave triggers, saves to database successfully
3. [Connection Lost] Internet drops unexpectedly
4. [Offline] You continue editing tax brackets
5. [Offline] Autosave triggers, saves to localStorage instead
6. [Offline] Status shows "Saved locally (pending sync)"
7. [Offline] You make more changes, multiple localStorage saves
8. [Connection Restored] Autosave detects network is back
9. [Syncing] Status shows "Syncing..." with spinner
10. [Online] All localStorage data uploads to database
11. [Online] Status shows "Synced successfully" with checkmark
12. [Online] localStorage backup cleared, normal operation resumes
```

**localStorage Capacity**:
- Browser limit: 5-10MB depending on browser
- Builder data typically uses <500KB
- Sufficient for thousands of autosave snapshots
- Warning shown if approaching limit (rare)

**Data Persistence**:
- localStorage survives browser refresh
- Data persists if you close and reopen browser
- Remains available until sync completes
- Manual browser data clearing removes localStorage

**Handling Extended Offline Periods**:

**Short Outages (< 5 minutes)**:
- Continue editing normally
- localStorage automatically saves changes
- Sync happens automatically when reconnected
- No user action required

**Medium Outages (5-30 minutes)**:
- localStorage continues saving all changes
- Consider copying critical data as backup
- Take screenshots of complex configurations
- Data will sync when connection restored

**Long Outages (> 30 minutes)**:
- localStorage remains reliable for hours/days
- Work can continue indefinitely offline
- Manual "Save Locally" button available
- Consider exporting data if outage extends beyond session

**Syncing After Reconnection**:

Autosave sync process:
1. Detects network is available (background ping)
2. Loads localStorage backup data
3. Uploads to database via API
4. Verifies successful save (200 response)
5. Clears localStorage backup
6. Updates status to "Synced successfully"

**Conflict Resolution During Sync**:
If changes were made on another device while offline:
- System detects conflicting timestamps
- Shows conflict resolution dialog
- You choose: Keep offline changes or Load server version
- Sync continues after resolution

**Testing Offline Behavior**:

To test autosave offline mode:
1. Open builder and make some changes
2. Open DevTools (F12) → Network tab
3. Select "Offline" from throttling dropdown
4. Continue editing - should see "Saved locally"
5. Re-enable network - should see "Syncing..."
6. Verify "Synced successfully" appears

**Limitations of Offline Mode**:
- Cannot load initial data when offline (edit mode requires connection)
- Authentication tokens may expire during long offline periods
- Sync requires valid Clerk session (may need re-login)
- localStorage can be cleared by browser in extreme cases
- No conflict detection until reconnection

**Best Practices for Offline Work**:
- Monitor "Saved locally" status during known outages
- Use manual "Save Locally" button periodically
- Take backups of critical data for long offline sessions
- Keep browser tab open until sync completes after reconnection
- Don't clear browser data while offline changes pending

**Data Safety Guarantees**:
- localStorage backup is written before network request sent
- If network fails mid-request, data is already in localStorage
- Browser refresh loads localStorage data back into React state
- Data persists even if browser crashes (localStorage is durable)
- Multiple layers of redundancy (React state → localStorage → Database)

## Troubleshooting

### "Save Failed" Error

When you see a "Save Failed" error, follow these troubleshooting steps to diagnose and resolve the issue:

**Step 1: Check Internet Connection**

```
Actions:
1. Look for network icon in browser status bar
2. Try loading another website (e.g., google.com)
3. Check WiFi or ethernet connection status
4. Try disabling VPN temporarily
5. Switch networks (WiFi → mobile hotspot) to test

Expected Result:
- Other websites should load normally
- Network icon should show connected status
- If connection is dead, fix network before proceeding
```

**Step 2: Verify Authentication Status**

```
Actions:
1. Check if you're still logged in (look for user avatar in header)
2. Navigate to another page and back to builder
3. Try clicking "Save Progress" button again
4. If prompted to login, re-authenticate with Clerk

Expected Result:
- User avatar visible in header
- No login prompts when navigating
- Clerk session active (not expired)
```

**Step 3: Check Browser Console for Errors**

```
Actions:
1. Press F12 to open DevTools
2. Click "Console" tab
3. Look for red error messages
4. Search for "autosave" or "tRPC" in console logs
5. Take screenshot of any error messages

Common Error Messages:
- "Failed to fetch": Network connection issue
- "401 Unauthorized": Authentication expired, need to re-login
- "500 Internal Server Error": Backend API issue, try again later
- "429 Too Many Requests": Rate limit hit, wait 60 seconds
- "Validation error": Invalid data format, check your inputs
```

**Step 4: Retry Manual Save**

```
Actions:
1. Click "Save Progress" button again
2. Wait 5 seconds for response
3. Watch status indicator for confirmation
4. Check console for new error messages

Expected Result:
- If successful: "Last saved at..." with green checkmark
- If failed again: Note the error message, proceed to Step 5
```

**Step 5: Check localStorage Backup**

```
Actions:
1. Open DevTools (F12) → Application/Storage tab
2. Expand "Local Storage" → ixstats.ixwiki.com
3. Look for autosave keys (nationalIdentity, government, taxSystem, economy)
4. Verify data exists in localStorage
5. If data missing, your changes may be lost

Expected Result:
- localStorage keys present with JSON data
- Data matches your current edits
- If present, data is safe even if database save failed
```

**Step 6: Test with Different Section**

```
Actions:
1. Navigate to a different builder section (e.g., National Identity → Government)
2. Make a small test change (e.g., adjust a budget slider)
3. Wait for autosave trigger (15 seconds)
4. Check if this section saves successfully

Expected Result:
- If test save works: Original section has invalid data, review inputs
- If test save fails: System-wide issue, proceed to Step 7
```

**Step 7: Refresh Page and Retry**

```
Actions:
1. Take screenshots of your current work (safety precaution)
2. Copy any long text fields to a document
3. Refresh browser (F5 or Ctrl+R / Cmd+R)
4. Wait for page to reload
5. Check if your data loaded from localStorage/database
6. Try making a change and saving again

Expected Result:
- Page reloads, autosave system reinitializes
- Data should load from last successful save
- New saves should work after refresh
```

**Step 8: Clear Cache and Retry**

```
Actions:
1. Open browser settings
2. Clear cache (but not cookies - keep your session)
3. Refresh page
4. Try saving again

Expected Result:
- Cached files cleared, fresh JavaScript loaded
- Autosave system reinitialized
- Saves should work with clean cache
```

**Step 9: Try Different Browser**

```
Actions:
1. Copy your current data (screenshots/text)
2. Open builder in different browser (Chrome → Firefox)
3. Make a test change
4. Try saving

Expected Result:
- If works in different browser: Original browser has issue (extensions, settings)
- If fails in all browsers: Server-side issue, contact support
```

**Step 10: Contact Support**

If all steps fail, gather this information for support:

```
Support Ticket Information:
- Browser type and version: [e.g., Chrome 119.0.6045.105]
- Operating system: [e.g., Windows 11, macOS 14.1]
- Error message from console: [copy exact text]
- Timestamp of failure: [e.g., 2025-11-09 2:47:32 PM]
- Section where error occurred: [National Identity / Government / Tax / Economy]
- Network status: [Online / Offline / Unstable]
- Recent actions: [What you were doing when error occurred]
- Screenshots: [Error message, console logs, status indicator]

Contact:
- Support email: support@ixwiki.com
- Discord: #ixstats-support channel
- GitHub issues: ixwiki/ixstats/issues
```

**Quick Reference - Error Code Meanings**:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 400 | Bad Request - Invalid data format | Check your inputs for invalid characters |
| 401 | Unauthorized - Session expired | Re-login via Clerk authentication |
| 403 | Forbidden - Missing permissions | Contact admin to verify your role |
| 404 | Not Found - Invalid country ID | Check if country exists in database |
| 429 | Rate Limited - Too many requests | Wait 60 seconds, then retry |
| 500 | Server Error - Backend issue | Try again in 5 minutes |
| 503 | Service Unavailable - Maintenance | Check status page, wait for restoration |

**Prevention Tips**:
- Save manually before risky actions (refresh, navigate away)
- Keep browser and OS updated
- Disable aggressive content blockers on ixwiki.com
- Maintain stable internet connection
- Avoid editing from multiple tabs simultaneously

### Changes Not Persisting

If your changes disappear after saving, follow this diagnostic guide:

**Symptom 1: Changes Lost After Browser Refresh**

```
Possible Causes:
- Autosave never triggered (15-second debounce not elapsed)
- Save failed silently (check status indicator)
- localStorage data not loading on page load
- Browser cleared localStorage automatically

Diagnostic Steps:
1. Make a test change and wait 30 seconds
2. Watch status indicator - does it show "Saving..." then "Last saved at..."?
3. Refresh page (F5) - do changes reload?
4. Check DevTools → Application → Local Storage for autosave keys
5. Check DevTools → Console for errors during page load

Solution:
- If autosave not triggering: Verify JavaScript enabled, no console errors
- If status shows success but refresh loses data: Database save failed, check network
- If localStorage empty after refresh: Browser settings clearing data, adjust privacy settings
- Always click "Save Progress" manually before refresh to ensure persistence
```

**Symptom 2: Changes Revert to Old Values After Saving**

```
Possible Causes:
- Another tab/device saved older data (conflict)
- Edit mode loading stale database data
- Caching issue showing old data
- API returning old values despite successful save

Diagnostic Steps:
1. Check if you have multiple tabs open with same country
2. Open DevTools → Network tab, filter for autosave API calls
3. Inspect response payload - does it contain your new values?
4. Compare localStorage data to what's displayed in UI
5. Check database directly (if admin access) to verify values

Solution:
- Close duplicate tabs to prevent conflicts
- Hard refresh (Ctrl+Shift+R) to clear cache
- Use manual "Save Progress" and verify green checkmark appears
- Contact admin to inspect database values if persists
```

**Symptom 3: Some Fields Persist, Others Don't**

```
Possible Causes:
- Validation errors on specific fields (rejected at API level)
- Field not included in autosave payload (implementation bug)
- Conditional logic skipping certain fields
- Data transformation issues during save

Diagnostic Steps:
1. Identify which fields persist vs which don't
2. Open DevTools → Network → Find autosave API call
3. Inspect request payload - are missing fields included?
4. Check response for validation errors
5. Try entering different values in non-persisting fields

Solution:
- If fields missing from payload: Report bug to developers
- If validation errors in response: Fix invalid values (e.g., negative numbers, special characters)
- If certain values rejected: Check min/max constraints, required formats
- Try simpler values to test (e.g., "Test" instead of special characters)
```

**Symptom 4: Manual Save Works, Autosave Doesn't**

```
Possible Causes:
- Debounce timer not triggering correctly
- Event listeners not attached to form inputs
- React state not updating to trigger autosave hooks
- Conditional logic preventing automatic saves

Diagnostic Steps:
1. Make a change and wait 30 seconds - does autosave trigger?
2. Check DevTools → Console for "Autosave triggered" debug logs
3. Verify status indicator changes from "Unsaved changes" to "Saving..."
4. Compare manual save vs autosave network requests in DevTools

Solution:
- If debounce not working: Try editing different field types (text input vs dropdown)
- If no "Unsaved changes" status: React state not updating, report bug
- Workaround: Use manual "Save Progress" button until autosave fixed
- Check for browser extensions interfering with timers (disable temporarily)
```

**Symptom 5: Changes Persist Temporarily, Then Revert**

```
Possible Causes:
- Edit mode reloading stale data from database
- Background sync overwriting your changes
- Conflict resolution choosing wrong version
- Tab coordination reverting to older localStorage data

Diagnostic Steps:
1. Note exact timestamp when reversion happens
2. Check if reversion coincides with tab switching
3. Open multiple tabs, see if one tab's changes overwrite another's
4. Monitor status indicator for unexpected "Saving..." messages
5. Check localStorage timestamps vs database timestamps

Solution:
- Edit from single tab/device at a time
- Close all other builder tabs before saving
- Wait for "Last saved at..." confirmation before switching tabs
- If multi-device editing needed: Always load latest data first (refresh)
```

**Common Root Causes Summary**:

| Cause | Frequency | Detection | Solution |
|-------|-----------|-----------|----------|
| Forgot to wait for autosave | Very Common | No "Last saved at..." before refresh | Wait 15 seconds after last edit |
| Multiple tabs conflict | Common | Changes appear then disappear | Close duplicate tabs |
| Network failure during save | Common | "Save failed" in status | Fix connection, retry save |
| Browser clearing localStorage | Uncommon | localStorage empty in DevTools | Adjust browser privacy settings |
| Validation errors | Uncommon | Errors in API response | Fix invalid data formats |
| Caching issues | Rare | Hard refresh fixes | Clear cache, hard refresh |
| Database transaction failure | Rare | 500 errors in console | Report to support |

**Verification Steps After Fix**:

To confirm changes are persisting correctly:
```
1. Make a test change (e.g., edit country name)
2. Wait 20 seconds for autosave
3. Verify "Last saved at..." appears with timestamp
4. See green checkmark animation
5. Refresh page (F5)
6. Confirm change reloaded correctly
7. Close tab completely
8. Reopen builder in new tab
9. Verify change still present
10. Try from different browser/device
11. Confirm change synced across devices
```

**Prevention Checklist**:
- [ ] Always wait for "Last saved at..." before leaving page
- [ ] Use manual "Save Progress" before critical actions
- [ ] Edit from one tab/device at a time
- [ ] Keep internet connection stable
- [ ] Don't clear browser data while editing
- [ ] Monitor status indicator continuously
- [ ] Take periodic screenshots of complex work

**When to Report a Bug**:
Report to developers if:
- Manual save works but autosave consistently fails
- Specific fields never persist despite successful save status
- Changes persist initially but revert after refresh
- localStorage and API payloads don't match UI state
- No validation errors but data still doesn't save

### Checking Autosave History

The autosave system maintains a comprehensive history of all save operations, allowing you to review past saves and troubleshoot issues:

**Accessing Autosave History Panel**:

```
Steps:
1. Navigate to the builder (National Identity, Government, Tax, or Economy section)
2. Look for "Autosave History" button in the builder header (next to "Save Progress")
3. Click the button to open the history panel
4. Panel slides in from the right side of the screen
5. Displays chronological list of all autosaves for current country

Location:
- Desktop: Right sidebar panel (400px wide)
- Mobile: Full-screen modal overlay
- Accessible from all builder sections
```

**History Panel Interface**:

```
Components:
- Header: "Autosave History for [Country Name]"
- Time Filter: [Last Hour] [Last 24 Hours] [Last 7 Days] [All Time]
- Section Filter: [All Sections] [National Identity] [Government] [Tax] [Economy]
- Search: Filter by field names or values
- Sort: [Newest First] [Oldest First]
- Entry List: Chronological autosave entries
- Pagination: 20 entries per page
```

**Autosave Entry Details**:

Each entry shows:
```
📅 November 9, 2025 at 2:47:32 PM
📝 Section: National Identity
✏️ Fields Changed: countryShortName, officialName
💾 Save Type: Automatic
✅ Status: Success
🔍 [View Details] [Restore] [Compare]
```

**Detailed Entry View**:

Click "View Details" to see:
```
Autosave Entry #12345

Timestamp: 2025-11-09 14:47:32 PST
Section: National Identity
Save Type: Automatic (debounced)
Status: Success (200 OK)
Duration: 247ms
Data Size: 1.2 KB

Fields Changed (3):
- countryShortName: "Ixonia" → "Republic of Ixonia"
- officialName: "The Nation of Ixonia" → "The Republic of Ixonia"
- flagMetadata: {...} (object changed)

API Request:
POST /api/trpc/nationalIdentity.upsert
Payload: [View JSON]

API Response:
Status: 200 OK
Success: true
Saved At: 2025-11-09T14:47:32.456Z

[Close] [Restore This Version]
```

**Filtering and Searching**:

**Time Filters**:
- Last Hour: Shows saves from past 60 minutes
- Last 24 Hours: Shows saves from past day
- Last 7 Days: Shows saves from past week
- All Time: Shows complete history (up to 90 days retention)

**Section Filters**:
- All Sections: Shows saves across all builder sections
- National Identity: Only national identity saves
- Government: Only government structure saves
- Tax System: Only tax configuration saves
- Economy: Only economic sector saves

**Search Examples**:
- Search "countryName" - Shows all saves that changed country name field
- Search "2:47 PM" - Shows all saves at that time
- Search "Success" - Shows only successful saves
- Search "Failed" - Shows only failed save attempts

**Comparing Versions**:

Click "Compare" to see side-by-side diff:
```
Comparing Autosaves

Version A (November 9, 2:45 PM) vs Version B (November 9, 2:47 PM)

National Identity Changes:
Field              | Version A                    | Version B
-------------------|------------------------------|------------------------------
countryShortName   | "Ixonia"                     | "Republic of Ixonia" [CHANGED]
officialName       | "The Nation of Ixonia"       | "The Republic of Ixonia" [CHANGED]
flagMetadata       | {url: "old.png"}             | {url: "new.png"} [CHANGED]
population         | 10000000                     | 10000000 [UNCHANGED]

Government Changes:
No changes between these versions.

[Close] [Restore Version A] [Restore Version B]
```

**Restoring Previous Versions**:

**⚠️ Warning: Restoration Overwrites Current Data**

To restore a previous autosave:
```
1. Find the autosave entry you want to restore
2. Click "Restore" button
3. Review confirmation dialog:

   "Are you sure you want to restore this version?

   This will overwrite your current data with:
   - Autosave from November 9, 2025 at 2:47:32 PM
   - Section: National Identity
   - 3 fields will be restored

   Current unsaved changes will be lost.

   [Cancel] [Confirm Restore]"

4. Click "Confirm Restore"
5. System loads historical data into React state
6. Autosave triggers immediately to persist restoration
7. Success toast: "Autosave restored successfully"
8. New autosave entry created: "Restored from [timestamp]"
```

**Use Cases for History Panel**:

1. **Troubleshooting Save Failures**:
   - View failed save attempts
   - Check error messages
   - Compare failed vs successful saves
   - Identify patterns in failures

2. **Reviewing Past Changes**:
   - See what you changed and when
   - Track editing timeline
   - Identify when specific changes were made
   - Audit trail for collaborative editing

3. **Recovering Accidental Changes**:
   - Find version before unwanted edit
   - Compare versions to identify mistake
   - Restore previous good version
   - Undo accidental overwrites

4. **Performance Analysis**:
   - Check save duration times
   - Identify slow saves
   - Monitor data size growth
   - Detect network issues

5. **Compliance and Auditing**:
   - Complete audit trail of all changes
   - Timestamp verification
   - User attribution (who made changes)
   - Data integrity validation

**History Retention Policy**:

```
Retention Period: 90 days
After 90 days: Autosaves automatically deleted from database
Rationale: Balance between history availability and database size
Exception: Manual saves retained longer (1 year)

Storage:
- Each autosave: 1-5 KB depending on data size
- Average country: 200 autosaves over 90 days = ~500 KB
- Database limit: 10,000 autosaves per country (safety limit)
```

**Privacy and Security**:

```
Access Control:
- Only country owner can view their autosave history
- Admins can view all autosave histories (audit purposes)
- No public access to autosave data
- History panel requires authentication

Data Protection:
- Autosave history encrypted in database
- API endpoints require valid session
- RBAC enforces access permissions
- Audit logs track history access
```

**Technical Implementation**:

```
Database Table: AutosaveHistory
Columns:
- id: UUID primary key
- userId: String (Clerk user ID)
- countryId: String (references Country)
- section: Enum (NATIONAL_IDENTITY, GOVERNMENT, TAX_SYSTEM, ECONOMY)
- data: JSON (complete section data snapshot)
- saveType: Enum (AUTOMATIC, MANUAL)
- status: Enum (SUCCESS, FAILED)
- errorMessage: String (if failed)
- duration: Int (milliseconds)
- dataSize: Int (bytes)
- createdAt: DateTime

Indexes:
- userId + countryId (fast user queries)
- createdAt (time-based filtering)
- section (section filtering)

API Endpoint:
- Route: /api/trpc/autosaveHistory.list
- Auth: Required (Clerk session)
- Rate Limit: 30 requests per minute
- Pagination: 20 entries per page
```

**Mobile Considerations**:

```
Mobile Interface:
- Full-screen modal overlay (no side panel)
- Touch-optimized buttons (larger tap targets)
- Swipe gestures for navigation
- Simplified entry cards for small screens
- Responsive table → card layout transformation
```

## Frequently Asked Questions

### How often does autosave happen?

Autosave triggers **15 seconds after you stop making changes**. This intelligent debouncing system batches rapid edits into a single save operation, providing optimal performance without overwhelming the database.

**How It Works**:
```
Timeline Example:
0:00 - You type a letter in country name field
0:01 - You type another letter
0:02 - You type another letter
0:03 - You stop typing
0:18 - Autosave triggers (15 seconds after last keystroke)
0:19 - Save completes, "Last saved at..." appears
```

**Why 15 Seconds?**:
- Prevents excessive database writes during rapid typing
- Balances data protection with performance
- Reduces server load and API costs
- Gives you time to complete thoughts before saving
- Minimizes race conditions from overlapping saves

**Immediate Alternatives**:
- Click "Save Progress" button for instant save (bypasses 15-second delay)
- Autosave triggers immediately on blur (leaving a field)
- Save happens before page unmount (navigating away)

### Can I disable autosave?

**No, autosave cannot be disabled.** It is a core data protection feature designed to prevent data loss and ensure your work is always safe.

**Why It's Always Active**:
- **Data Protection**: Prevents loss from browser crashes, network failures, accidental navigation
- **User Safety**: Many users forget to save manually, leading to frustration
- **Best Practice**: Industry-standard approach (Google Docs, Notion, etc. all use autosave)
- **Performance**: Optimized to not impact typing or UI responsiveness

**Control Options You Have**:
1. **Manual Save Button**: Click "Save Progress" anytime to force immediate save
2. **Debounce Timing**: System waits 15 seconds, so you control when save happens by pausing edits
3. **Offline Mode**: Works offline with localStorage, syncs when reconnected
4. **Save Frequency**: Naturally adjusts based on your editing pace

**If You Prefer Manual Control**:
- Use "Save Progress" button exclusively (ignore automatic saves)
- Autosave still works in background as safety net
- Manual saves override automatic saves (same API endpoint)

**Performance Impact**: Autosave is optimized to have zero noticeable impact on your editing experience. The 15-second debounce and efficient tRPC APIs ensure saves happen seamlessly in the background.

### What if I lose internet connection?

Autosave is designed to handle network interruptions gracefully through intelligent fallback mechanisms:

**Automatic localStorage Backup**:
When your internet connection drops:
1. Autosave detects network failure immediately
2. Data automatically saves to browser localStorage instead
3. Status indicator shows "Saved locally (pending sync)"
4. You can continue editing without interruption
5. All changes persist in localStorage until connection restored

**Automatic Sync on Reconnection**:
When your internet returns:
1. Autosave detects network is available (background ping)
2. Automatically uploads localStorage data to database
3. Status shows "Syncing..." during upload
4. Confirmation: "Synced successfully" with green checkmark
5. localStorage backup cleared after successful database save

**What You'll See**:
```
Offline Flow:
[Online] "Last saved at 2:45 PM" →
[Lost Connection] "Connection lost" toast notification →
[Offline] You continue editing →
[Offline] Autosave triggers →
[Offline] "Saved locally (pending sync)" status →
[Reconnected] "Connection restored" toast →
[Syncing] "Syncing..." status with spinner →
[Online] "Synced successfully" with green checkmark →
[Online] "Last saved at 2:47 PM"
```

**Data Safety**:
- localStorage data survives browser refresh and crashes
- Changes persist even if you close and reopen browser
- Multiple layers of protection (React state → localStorage → Database)
- Data never lost during offline periods

**Long Offline Sessions**:
- localStorage can hold data for hours or days
- No practical limit for typical builder data (<500KB)
- Sync happens automatically whenever connection restored
- Work offline as long as needed without data loss

**Manual Control**:
- Click "Save Locally" button during offline periods (button label changes when offline)
- Force sync attempt with "Save Progress" when reconnected
- Check localStorage in DevTools to verify backup exists

**Limitations**:
- Cannot load initial data when offline (edit mode requires connection to fetch existing country)
- Authentication tokens may expire during very long offline periods (requires re-login)
- Conflict detection only happens when reconnected (if edited from multiple devices)

### How long are autosaves kept?

**Retention Period: 90 Days**

All autosave history entries are retained in the database for **90 days** from the date they were created. After 90 days, entries are automatically deleted to manage database size.

**Storage Details**:
```
Autosave History Retention:
- Standard autosaves: 90 days
- Manual "Save Progress" saves: 90 days (same as automatic)
- localStorage backups: Until synced to database (then cleared)
- Current country data: Permanent (no expiration)

Typical Storage per Country:
- Average autosaves over 90 days: ~200 entries
- Storage per entry: 1-5 KB (depending on data size)
- Total per country: ~500 KB for 90 days of history
- Database safety limit: 10,000 autosaves per country
```

**What Gets Deleted After 90 Days**:
- Autosave history entries (historical snapshots)
- Timestamps and metadata
- Field change logs
- Save success/failure records

**What Is Permanent**:
- Your current country data (latest saved state)
- Country configurations and settings
- All active national identity, government, tax, economy data
- User account and authentication data

**Accessing Historical Data**:
- View autosave history panel in builder
- Filter by date range (Last Hour / Last 24 Hours / Last 7 Days / All Time)
- "All Time" shows up to 90 days of history
- Entries older than 90 days not accessible

**Retention Policy Rationale**:
- **Balance**: Sufficient history for troubleshooting without bloating database
- **Performance**: Smaller database = faster queries and better performance
- **Privacy**: Automatic cleanup of old data reduces long-term storage
- **Cost**: Reduces database storage costs for the platform

**If You Need Longer History**:
- Export your country data periodically (JSON format)
- Take screenshots of important configurations
- Use manual backups for critical milestones
- Contact support for special retention requests

**Admin Access**:
- Admins have longer retention (1 year) for audit purposes
- Admin autosave access limited to compliance and troubleshooting
- User data privacy maintained even with extended admin retention

### Does autosave work across devices?

**Yes, autosaves are stored in the database and accessible from any device once you log in.**

**How Cross-Device Sync Works**:

```
Multi-Device Flow:
1. Device A: Edit country on your laptop
2. Device A: Autosave triggers, data saved to database
3. Device B: Open builder on your phone
4. Device B: System loads latest data from database (includes Device A's changes)
5. Device B: Make more edits
6. Device B: Autosave triggers, data saved to database
7. Device A: Refresh browser, loads Device B's changes
8. Both devices now show identical data
```

**Synchronization Details**:

**Authentication-Based Sync**:
- All autosaves associated with your Clerk user account
- Login on any device to access your countries
- Same userId = same data across all devices

**Real-Time Behavior**:
- Autosaves sync immediately to database (1-2 second latency)
- Changes available on other devices after refresh
- No manual sync required - happens automatically
- WebSocket real-time sync (planned for future - currently requires refresh)

**Supported Devices**:
- **Desktop**: Windows, macOS, Linux browsers
- **Mobile**: iOS Safari, Android Chrome
- **Tablet**: iPad Safari, Android tablets
- **Any Browser**: Chrome, Firefox, Safari, Edge

**Cross-Device Workflow Example**:

```
Morning (Home Desktop):
- Start building country on home computer
- Edit National Identity section
- Autosave: "Last saved at 8:45 AM"
- Leave for work

Afternoon (Work Laptop):
- Login at work computer
- Open builder, edit mode loads your country
- Continue editing Government section
- Autosave: "Last saved at 2:30 PM"
- Leave work

Evening (Mobile Phone):
- Open IxStats on phone while commuting
- Builder loads your country with all previous changes
- Review work, make minor edits to tax system
- Autosave: "Last saved at 6:15 PM"
- Get home

Night (Home Desktop):
- Return to home computer
- Refresh browser, loads all changes from work and phone
- Continue editing economy section
- All previous work preserved across devices
```

**Conflict Handling**:

If editing on multiple devices simultaneously:
```
Scenario:
1. Device A: Edit country name to "Ixonia Republic" (2:46:00 PM)
2. Device B: Edit country name to "Republic of Ixonia" (2:46:30 PM)
3. Both autosaves trigger and send to database
4. Device B's save has newer timestamp, wins conflict
5. Device A: On next refresh, loads "Republic of Ixonia" (Device B's version)
6. System shows conflict notification with resolution options
```

**Best Practices for Multi-Device Editing**:
- Always refresh before starting major edits (loads latest data)
- Complete edits on one device before switching to another
- Check "Last saved at..." timestamp to verify data is current
- Use manual "Save Progress" before switching devices
- Avoid editing same fields on multiple devices simultaneously

**Data Freshness**:
- Latest autosave always wins (last-write-wins strategy)
- Timestamps determine which version is newest
- Stale data replaced on refresh/page load
- Conflict resolution dialog if significant differences detected

**localStorage vs Database**:
- **localStorage**: Device-specific, not synced across devices
- **Database**: Cloud-stored, accessible from any device
- **Sync Flow**: localStorage → Database → Other Devices
- **Offline**: Changes save to localStorage, sync to database when reconnected, then available on other devices

**Limitations**:
- Requires internet connection to sync (offline changes remain local until connected)
- Must refresh/reload page to see changes from other devices (WebSocket real-time sync planned)
- Authentication session must be active on all devices (Clerk login)

### What sections have autosave?

Autosave is available across **all four major builder sections**, providing comprehensive data protection for your entire nation configuration:

**1. National Identity Section** ✅
```
What's Saved:
- Country Names:
  - Short name (common name)
  - Formal name (official ceremonial name)
  - Official name (government designation)
- Symbols:
  - Flag metadata (URLs, descriptions)
  - Coat of arms details
  - National anthem information
- Culture:
  - Official languages
  - Ethnic groups and demographics
  - Cultural heritage information
  - Religious affiliations
- Geography:
  - Capital city
  - Major cities
  - Geographic regions
  - Climate zones
  - Natural resources

Autosave Hook: useNationalIdentityAutoSync()
API Endpoint: nationalIdentity.upsert
Trigger: 15 seconds after last change
```

**2. Government Structure Section** ✅
```
What's Saved:
- Atomic Components:
  - 106 government components selections
  - Component effectiveness scores
  - Synergy combinations
  - Component descriptions
- Traditional Departments:
  - Department selections
  - Budget allocations
  - Leadership assignments
  - Ministry configurations
- Government Type:
  - Basic government structure
  - Leadership hierarchy
  - Constitutional framework
- Budget Settings:
  - Departmental budgets
  - Fiscal allocations
  - Spending priorities

Autosave Hook: useGovernmentAutoSync()
API Endpoint: government.upsert
Trigger: 15 seconds after last change
```

**3. Tax System Section** ✅
```
What's Saved:
- Income Tax:
  - Tax brackets (income ranges)
  - Tax rates per bracket
  - Progressive/flat tax settings
- Tax Categories:
  - Corporate tax rates
  - Capital gains tax
  - VAT/sales tax
  - Property tax
  - Payroll tax
  - Import/export duties
- Deductions:
  - Standard deduction amounts
  - Itemized deductions
  - Tax credits
- Fiscal Policy:
  - Overall tax burden
  - Revenue projections
  - Fiscal balance settings

Autosave Hook: useTaxSystemAutoSync()
API Endpoint: taxSystem.upsert
Trigger: 15 seconds after last change
```

**4. Economic Configuration Section** ✅
```
What's Saved:
- Sectors:
  - 12 economic sectors
  - Sector GDP shares
  - Employment per sector
  - Growth rates
  - Tier selections (Tier 1-4)
- Demographics:
  - Total population
  - Age distribution
  - Urban/rural split
  - Education levels
- Labor Market:
  - Labor force size
  - Employment rate
  - Unemployment rate
  - Workforce participation
  - Wage levels
- Economic Indicators:
  - GDP calculations
  - Per capita income
  - Economic growth projections
  - Inflation rates

Autosave Hook: useEconomyBuilderAutoSync()
API Endpoint: economics.upsert
Trigger: 15 seconds after last change
```

**Autosave Coverage Summary**:

| Section | Fields Saved | Average Size | Save Frequency | Hook Name |
|---------|--------------|--------------|----------------|-----------|
| **National Identity** | 20+ fields | 2-5 KB | Every 15s | useNationalIdentityAutoSync |
| **Government** | 150+ fields | 10-20 KB | Every 15s | useGovernmentAutoSync |
| **Tax System** | 30+ fields | 3-8 KB | Every 15s | useTaxSystemAutoSync |
| **Economy** | 50+ fields | 5-15 KB | Every 15s | useEconomyBuilderAutoSync |

**What's NOT Autosaved** (Currently):
- Builder UI state (tab selections, panel open/closed)
- Temporary validation errors
- Form focus state
- Undo/redo history (browser-based only)
- Draft comments or notes (if added in future)

**Planned Future Autosave Sections** (Roadmap):
- Defense & Military section
- Diplomatic Relations section
- Social Policies section
- Infrastructure Projects section

**Technical Implementation**:
Each section has:
- Dedicated React hook for autosave logic
- Independent debounce timer (15 seconds)
- Separate tRPC API endpoint
- Isolated database tables
- Section-specific validation

**Cross-Section Coordination**:
- Autosaves from different sections don't conflict
- Each section saves independently
- Status indicator shows most recent save across all sections
- History panel filters by section

### Can I undo autosaves?

**Not directly via an "undo" button, but you can view autosave history and restore previous versions.**

**Current Undo/Redo Capabilities**:

**Browser-Level Undo** (Limited):
- **Ctrl+Z / Cmd+Z**: Undo typing in text fields (browser-native)
- **Scope**: Only affects current field during active editing session
- **Limitation**: Resets after autosave, page refresh, or field blur
- **Use Case**: Quickly undo typos while typing

**Autosave History Restoration** (Comprehensive):
- **Access**: Click "Autosave History" button in builder header
- **View**: See chronological list of all saves (up to 90 days)
- **Compare**: Side-by-side diff between versions
- **Restore**: Revert entire section to previous autosave
- **Scope**: Restores complete section state (all fields)

**How to "Undo" an Autosave**:

```
Step-by-Step Process:
1. Click "Autosave History" button in builder header
2. History panel opens, showing all previous autosaves
3. Find the autosave BEFORE the unwanted change:
   - Example: Current = 2:47 PM (mistake)
   - Find: 2:45 PM (last good version)
4. Click "View Details" on the 2:45 PM entry
5. Review fields to confirm this is the version you want
6. Click "Restore" button
7. Confirmation dialog:
   "Are you sure you want to restore this version?
   This will overwrite your current data."
8. Click "Confirm Restore"
9. System loads 2:45 PM data into builder
10. Autosave triggers immediately to persist restoration
11. New history entry created: "Restored from 2:45 PM"
```

**Example Undo Scenario**:

```
Timeline:
2:40 PM - Country name: "Ixonia"
2:45 PM - Country name: "Republic of Ixonia" (autosave #1)
2:47 PM - Country name: "Ixonian Republic" (autosave #2 - mistake!)
2:50 PM - Realize mistake, want to undo

Undo Process:
1. Open autosave history panel
2. Find autosave #1 at 2:45 PM
3. See "Republic of Ixonia" was the correct name
4. Restore autosave #1
5. Builder now shows "Republic of Ixonia" again
6. Autosave creates new entry: "Restored from 2:45 PM autosave"
7. Mistake undone successfully!
```

**Limitations of Current Undo**:

**Cannot Undo Individual Field Changes**:
- Restoration is section-wide (all fields in National Identity, Government, etc.)
- Cannot undo just country name while keeping other recent changes
- Workaround: Manually copy desired field values, restore old version, paste values back

**No Granular Redo**:
- After restoring old version, cannot "redo" to newer version automatically
- Must find and restore newer version from history manually
- History panel retains all versions, so redo is possible but not one-click

**15-Second Granularity**:
- Autosaves happen every 15 seconds (debounced)
- Cannot undo individual keystrokes or character-level changes
- Undo returns to last autosave checkpoint (15+ seconds ago)

**Planned Future Enhancements** (Roadmap):

**Granular Undo/Redo System**:
```
Planned Features:
- [ ] Field-level undo (undo country name only, not entire section)
- [ ] Undo/Redo buttons in builder header
- [ ] Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- [ ] Visual undo stack indicator
- [ ] Undo history limited to current session (resets on page load)
- [ ] Selective restoration (choose which fields to restore)
```

**Change Tracking System**:
```
Planned Features:
- [ ] Real-time change log (every keystroke tracked)
- [ ] Diff view for every edit
- [ ] Branching history (try different versions, switch between them)
- [ ] Named checkpoints (manually save "good" versions)
- [ ] Collaborative undo (multi-user editing)
```

**Current Best Practices for Undo-Like Behavior**:

1. **Frequent Manual Saves**: Click "Save Progress" at logical checkpoints to create restore points
2. **Review Before Autosave**: Check your changes within 15 seconds (before autosave triggers)
3. **History Panel Access**: Keep history panel open while making risky changes
4. **Copy Critical Data**: Copy important values before major edits (paste back if needed)
5. **Test Changes**: Make small edits, save, verify, then proceed to larger changes

**Contact Admin for Data Recovery**:
If you need to undo changes beyond 90 days (history retention limit) or recover deleted data, contact an administrator. Admins may have access to extended backups or database snapshots.

## Privacy and Security

### Data Ownership and Access

**Your Data Belongs to You**:
- All autosaves are associated with your Clerk user account (userId)
- Only you can view, edit, and restore your country's autosave data
- No other users can access your autosave history or country configurations
- Admins have limited access for audit and troubleshooting purposes only

**Access Control Matrix**:

| User Type | View Own Autosaves | Edit Own Data | View Others' Autosaves | Restore Others' Data | Delete Autosaves |
|-----------|-------------------|---------------|------------------------|---------------------|------------------|
| **Regular User** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes (audit only) | ⚠️ Limited (support) | ⚠️ Limited (retention) |
| **System** | ⚠️ Automated | ⚠️ Autosave | ⚠️ Monitoring | ❌ No | ✅ 90-day cleanup |

**Admin Access Restrictions**:
- Admins can view autosave history for troubleshooting and compliance
- Admin access is logged in audit trail (who accessed, when, why)
- Admins cannot edit user data without explicit permission
- Admin restoration limited to critical data recovery scenarios
- All admin actions visible in audit logs

### Data Encryption and Protection

**Encryption in Transit**:
- All autosave API requests use **HTTPS (TLS 1.3)**
- Data encrypted during transmission between browser and server
- WebSocket connections (future feature) will use WSS (secure WebSocket)
- Man-in-the-middle attacks prevented by certificate pinning

**Encryption at Rest**:
- Database encryption enabled on PostgreSQL (production)
- Autosave data stored with **AES-256 encryption** at database level
- localStorage data protected by browser security (same-origin policy)
- Backup snapshots encrypted in cloud storage

**Authentication and Authorization**:
- **Clerk Authentication**: Industry-standard OAuth 2.0 / OIDC
- Session tokens encrypted and signed (JWT)
- **8-Layer Middleware**: RBAC, rate limiting, session validation
- API endpoints require valid Clerk session (no anonymous access)

**Data Validation**:
- Input validation at frontend (React forms)
- Backend validation at API layer (tRPC procedures)
- Database constraints enforce data integrity
- XSS and SQL injection prevention (parameterized queries)

### Audit Logging

**What Gets Logged**:
```
Autosave Activity Logged:
- Timestamp of every autosave operation
- User ID (Clerk userId) performing the save
- Country ID being saved
- Section being saved (National Identity, Government, etc.)
- Save type (AUTOMATIC vs MANUAL)
- Success/failure status
- Error messages (if save failed)
- Data size (bytes)
- Save duration (milliseconds)
- IP address (for security monitoring)
- User agent (browser/device info)
```

**Audit Log Access**:
- Regular users cannot view audit logs (admin-only)
- Admins access via admin dashboard (`/admin/audit-logs`)
- Logs retained for **1 year** (longer than autosave data)
- Compliance export available (CSV/JSON format)

**Security Events Logged**:
```
High-Security Events:
- Failed authentication attempts
- Unauthorized access attempts to others' data
- Rate limit violations (suspicious activity)
- Data restoration operations (undo actions)
- Admin access to user data
- Bulk data exports
- Database query anomalies
```

**Audit Trail Example**:
```
[2025-11-09 14:47:32] INFO: Autosave triggered
  User: user_2abc123xyz
  Country: country_789def
  Section: NATIONAL_IDENTITY
  Type: AUTOMATIC
  Status: SUCCESS
  Duration: 247ms
  Data Size: 1.2 KB
  IP: 192.168.1.100
  User Agent: Chrome/119.0 Windows 11

[2025-11-09 14:47:35] INFO: Autosave history viewed
  User: user_2abc123xyz
  Country: country_789def
  Duration: 5s

[2025-11-09 14:48:00] WARN: Save failed - retrying
  User: user_2abc123xyz
  Country: country_789def
  Section: GOVERNMENT
  Error: Network timeout (5000ms)
  Retry: 1 of 3
```

### Rate Limiting and Abuse Prevention

**Rate Limits on Autosave**:
```
Limits (Per User):
- Automatic autosaves: No limit (debounced, inherently limited)
- Manual "Save Progress": 60 saves per minute
- Autosave history access: 30 requests per minute
- Data restoration: 10 restores per hour
- API queries: 1000 requests per 15 minutes (global limit)
```

**Why Rate Limits Exist**:
- Prevent database overload from malicious users
- Protect against automated bot attacks
- Ensure fair resource allocation across users
- Prevent accidental infinite save loops (bug protection)

**What Happens When Rate Limited**:
```
User Experience:
1. Save button becomes disabled
2. Status shows "Rate limit reached - wait 60 seconds"
3. Toast notification: "Too many save attempts. Please wait."
4. Automatic retry countdown timer displayed
5. Normal operation resumes after cooldown period
```

**Rate Limit Implementation**:
- **Production**: Redis-based rate limiting (accurate, distributed)
- **Development**: In-memory rate limiting (single-server)
- Rate limit headers returned in API responses
- Client-side enforcement (button disabled) + server-side validation

**Abuse Detection**:
```
Suspicious Activity Triggers:
- More than 100 autosaves per minute (automated script)
- Rapid restoration of many versions (bot behavior)
- Accessing other users' data (unauthorized access attempt)
- Unusual API query patterns (potential attack)
- High data volume saves (potential DOS)

Automated Responses:
- Temporary account suspension (15-minute cooldown)
- IP address rate limiting (stricter limits)
- Admin notification (security alert)
- Audit log flagging (for investigation)
```

### Data Privacy Compliance

**GDPR Compliance** (European Users):
- Right to access your data (export autosave history)
- Right to rectification (edit your data)
- Right to erasure (delete account and all autosaves)
- Right to data portability (JSON export)
- Lawful basis: Consent (terms of service acceptance)

**CCPA Compliance** (California Users):
- Right to know what data is collected (autosave metadata)
- Right to delete personal information
- Right to opt-out of data sharing (no third-party sharing)
- Non-discrimination for exercising rights

**Data Minimization**:
- Only necessary data collected (userId, countryId, section data)
- No tracking cookies or analytics on autosave data
- No third-party data sharing or selling
- localStorage used only for offline fallback (not tracking)

**Data Retention**:
- Autosave history: 90 days (automatic deletion)
- Audit logs: 1 year (compliance requirement)
- Current country data: Until user deletes account
- Deleted account data: Purged within 30 days (GDPR/CCPA)

### Security Best Practices for Users

**Protect Your Account**:
- Use strong password (Clerk password requirements)
- Enable two-factor authentication (2FA) via Clerk
- Never share your login credentials
- Log out from public/shared computers
- Monitor account activity for suspicious behavior

**Browser Security**:
- Keep browser updated (security patches)
- Use reputable browsers (Chrome, Firefox, Safari, Edge)
- Enable browser security features (phishing protection)
- Clear cache/cookies on shared devices after use
- Avoid browser extensions that access form data

**Network Security**:
- Use secure WiFi networks (avoid public WiFi for sensitive edits)
- Enable VPN on untrusted networks
- Verify HTTPS connection (lock icon in address bar)
- Don't access IxStats on compromised devices

**Data Safety**:
- Manually save before closing browser on shared devices
- Clear localStorage on public computers (DevTools → Application → Clear)
- Don't edit sensitive data on untrusted devices
- Use manual "Save Progress" before logging out

**Reporting Security Issues**:
- Email: security@ixwiki.com
- Subject: "Security Issue - Autosave System"
- Include: Steps to reproduce, browser/OS, severity assessment
- Responsible disclosure policy (no public disclosure until patched)

## Getting Help

### Self-Service Troubleshooting

**Before contacting support, try these self-service steps:**

1. **Check Documentation**:
   - Re-read relevant sections of this user guide
   - Review [FAQ section](#frequently-asked-questions) above
   - Check [Troubleshooting section](#troubleshooting) for common issues

2. **Browser DevTools Inspection**:
   - Press F12 to open DevTools
   - Console tab: Look for error messages
   - Network tab: Check autosave API calls for failures
   - Application tab: Verify localStorage data exists

3. **Test Basic Functionality**:
   - Make a small test change (edit a field)
   - Wait 20 seconds for autosave trigger
   - Check status indicator for "Last saved at..."
   - Refresh page to verify data persistence

4. **Try Different Browser**:
   - Test in Chrome, Firefox, or Edge
   - Use incognito/private mode to rule out extensions
   - Check if issue is browser-specific

5. **Check System Status**:
   - Visit https://status.ixwiki.com (if available)
   - Check Discord #announcements for known issues
   - Search GitHub issues for similar problems

### When to Contact Support

**Contact support if you encounter:**

**Critical Issues** (Immediate Support):
- ⚠️ Data loss (autosaves not restoring your work)
- ⚠️ Account access problems (locked out, can't login)
- ⚠️ Persistent save failures (all retries exhausted)
- ⚠️ Security concerns (unauthorized access to your account)
- ⚠️ Database corruption (data showing incorrect values)

**High Priority** (24-Hour Response):
- 🔴 Autosave consistently failing for specific section
- 🔴 Conflict resolution not working (data keeps reverting)
- 🔴 Autosave history panel not loading
- 🔴 Manual "Save Progress" button not working
- 🔴 Offline sync failing to upload when reconnected

**Medium Priority** (48-Hour Response):
- 🟡 Inconsistent autosave behavior (works sometimes, fails others)
- 🟡 Status indicator showing incorrect information
- 🟡 Performance issues (slow saves, UI lag during autosave)
- 🟡 Toast notifications not appearing
- 🟡 Browser compatibility issues

**Low Priority** (1-Week Response):
- 🟢 Feature requests (granular undo, longer history retention)
- 🟢 UI/UX improvement suggestions
- 🟢 Documentation feedback
- 🟢 General questions about autosave functionality

### How to Contact Support

**Email Support**:
```
To: support@ixwiki.com
Subject: [Autosave Issue] Brief description

Template:
---
**Issue Description:**
[Describe what's happening and what you expected]

**Browser & OS:**
[e.g., Chrome 119.0 on Windows 11]

**Steps to Reproduce:**
1. [First action]
2. [Second action]
3. [Result]

**Error Messages:**
[Copy exact error text from console or UI]

**Timestamp:**
[When did issue occur? e.g., 2025-11-09 2:47 PM PST]

**Country ID:**
[If applicable, your country ID from URL]

**Screenshots:**
[Attach screenshots of error, console, network tab]
---
```

**Discord Support** (Community + Official):
- Server: https://discord.gg/ixwiki
- Channel: #ixstats-support
- Tag: @IxStats Support Team
- Response Time: 1-4 hours (community often responds faster)

**GitHub Issues** (Bug Reports):
- Repository: https://github.com/ixwiki/ixstats/issues
- Label: `bug`, `autosave`, `data-persistence`
- Template: Use bug report template (auto-populated)
- Public: Issue visible to all users (avoid sensitive data)

**Live Chat** (Business Hours):
- Available: Monday-Friday, 9 AM - 5 PM PST
- Access: Click "Support" icon in app header (if enabled)
- Best For: Quick questions, real-time troubleshooting

### Information to Include in Support Requests

**Essential Information** (Always Include):
```
1. User ID: [Your Clerk userId - found in account settings]
2. Country ID: [From URL, e.g., country_789def]
3. Browser: [Name and version, e.g., Chrome 119.0.6045.105]
4. Operating System: [e.g., Windows 11, macOS 14.1, iOS 17.0]
5. Timestamp: [Exact time issue occurred, include timezone]
6. Section: [Where issue happened: National Identity / Government / Tax / Economy]
```

**Error Details** (If Applicable):
```
7. Error Message: [Exact text from UI or console]
8. Console Logs: [Copy from DevTools Console tab]
9. Network Errors: [HTTP status code, e.g., 500, 403, 429]
10. Save Type: [Automatic or Manual "Save Progress"]
```

**Context** (Helpful for Diagnosis):
```
11. What You Were Doing: [Actions leading up to issue]
12. Expected Behavior: [What should have happened]
13. Actual Behavior: [What actually happened]
14. Frequency: [Does this happen every time, or intermittently?]
15. Workarounds: [Have you found any temporary solutions?]
```

**Technical Details** (For Advanced Issues):
```
16. localStorage Data: [From DevTools → Application → Local Storage]
17. Network Request: [Request/response from Network tab]
18. React State: [If visible in React DevTools]
19. Autosave History: [Last 5 autosave entries from history panel]
20. Rate Limit Status: [Any "rate limited" messages?]
```

**Screenshots** (Highly Recommended):
- ✅ Error message or toast notification
- ✅ Browser console with errors highlighted
- ✅ Network tab showing failed request
- ✅ Autosave status indicator showing issue
- ✅ Autosave history panel (if relevant)

**How to Capture Console Logs**:
```
Steps:
1. Open DevTools (F12)
2. Click "Console" tab
3. Right-click anywhere in console
4. Select "Save as..." or "Copy all messages"
5. Attach saved file to support request
```

**How to Capture Network Logs**:
```
Steps:
1. Open DevTools (F12)
2. Click "Network" tab
3. Find failed request (red status code)
4. Right-click request → "Copy" → "Copy as HAR"
5. Paste into text file, attach to support request
```

### Expected Response Times

**Support SLAs** (Service Level Agreements):

| Priority | First Response | Resolution Target | Channels |
|----------|----------------|-------------------|----------|
| **Critical** | 2 hours | 24 hours | Email, Discord |
| **High** | 24 hours | 3 business days | Email, Discord |
| **Medium** | 48 hours | 1 week | Email, Discord, GitHub |
| **Low** | 1 week | Best effort | GitHub, Discord |

**Business Hours**:
- Monday - Friday: 9 AM - 5 PM PST
- Saturday - Sunday: Limited support (critical issues only)
- Holidays: Emergency support only

**Community Support** (Discord):
- Available 24/7 (community volunteers)
- Faster response times (often < 1 hour)
- No SLA guarantee (best effort)
- Great for quick questions and peer troubleshooting

### Additional Resources

**Documentation**:
- **Technical Docs**: `/docs/AUTOSAVE_TECHNICAL_GUIDE.md` (developer reference)
- **API Reference**: `/docs/reference/api-complete.md` (tRPC autosave endpoints)
- **Database Schema**: `/docs/reference/database.md` (AutosaveHistory table)
- **Architecture**: `/docs/systems/builder.md` (builder system overview)

**Video Tutorials** (Planned):
- "Understanding Autosave" (5 minutes)
- "Troubleshooting Save Failures" (8 minutes)
- "Using Autosave History Panel" (10 minutes)
- "Multi-Device Editing Best Practices" (7 minutes)

**Community Forums**:
- **Discord**: Most active, fastest responses
- **Reddit**: r/ixwiki (community discussions)
- **GitHub Discussions**: Long-form technical discussions

**Status and Monitoring**:
- **System Status**: https://status.ixwiki.com (uptime monitoring)
- **Changelog**: https://ixwiki.com/changelog (release notes)
- **Known Issues**: GitHub Issues page (open bugs)

---

**Document Version**: 1.0
**Last Updated**: November 10, 2025
**Related Documentation**:
- [Autosave Technical Guide](./AUTOSAVE_TECHNICAL_GUIDE.md)
- [Builder System Documentation](./docs/systems/builder.md)
- [Database Reference](./docs/reference/database.md)

**Feedback**: Have suggestions for improving this guide? Contact us at docs@ixwiki.com or submit a PR on GitHub.