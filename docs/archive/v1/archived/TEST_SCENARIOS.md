# MyCountry Editor - Testing Scenarios

## 🧪 Comprehensive Test Suite

Use these scenarios to verify all functionality works correctly before production deployment.

## ✅ Basic Functionality Tests

### Test 1: Instant Changes (National Identity)
**Expected Delay**: Immediate

1. Navigate to Identity tab
2. Change country name from "Testos" to "Testos Republic"
3. Change leader name
4. Update flag URL
5. Click "Review Changes"
6. Verify all show as "Instant Changes" (green)
7. Confirm and save
8. Verify changes apply immediately
9. Refresh page - changes should persist

**Success Criteria**:
- ✅ All changes instant (green badge)
- ✅ No warnings displayed
- ✅ Applied immediately
- ✅ Data persists after refresh

---

### Test 2: Low Impact Changes (Government Type)
**Expected Delay**: 1 IxDay

1. Navigate to Identity tab
2. Change government type from "Constitutional Monarchy" to "Federal Republic"
3. Click "Review Changes"
4. Verify shows as "Next IxDay" (blue)
5. Check warning about efficiency ratings
6. Confirm and save
7. Verify change is scheduled
8. Check Scheduled Changes Panel shows pending change with countdown

**Success Criteria**:
- ✅ Scheduled for next day
- ✅ Warning about government efficiency displayed
- ✅ Appears in pending changes panel
- ✅ Countdown timer shows correctly

---

### Test 3: Medium Impact Changes (Tax Rates)
**Expected Delay**: 3-5 IxDays

1. Navigate to Fiscal tab
2. Change tax revenue from 25% to 35% of GDP
3. Click "Review Changes"
4. Verify shows as "Short Term (3-5 IxDays)" (yellow)
5. Check warnings:
   - "Tax changes require legislative approval"
   - "May affect government revenue and public services"
   - "Could impact economic growth and investment"
6. Verify shows implementation time explanation
7. Confirm and save
8. Check scheduled for 3-5 days from now
9. Verify appears in pending changes panel

**Success Criteria**:
- ✅ Scheduled for 3-5 days
- ✅ Multiple warnings shown
- ✅ Impact explanation displayed
- ✅ Change is cancellable

---

### Test 4: High Impact Changes (GDP Growth)
**Expected Delay**: 1 IxWeek (7 days)

1. Navigate to Core Economics tab
2. Change Real GDP Growth Rate from 3.0% to 7.5%
3. Click "Review Changes"
4. Verify shows as "Long Term (1 IxWeek)" (red)
5. Check warnings:
   - "GDP growth rate changes reflect major economic shifts"
   - "Affects all downstream economic calculations"
   - "May trigger cascading effects"
   - "Markets and institutions need significant adjustment time"
6. Verify high-impact alert banner appears
7. Confirm and save
8. Verify scheduled for exactly 7 days from now

**Success Criteria**:
- ✅ Scheduled for 7 days
- ✅ High-impact banner shown
- ✅ Multiple detailed warnings
- ✅ Red color coding throughout

---

### Test 5: Multiple Changes (Mixed Impact Levels)
**Expected**: Different delays for different changes

1. Make the following changes:
   - Name: "Test Country" (instant)
   - Government type: "Parliamentary Democracy" (1 day)
   - Tax rate: 30% (3-5 days)
   - GDP growth: 5.0% (7 days)
2. Click "Review Changes"
3. Verify preview dialog groups them correctly:
   - Instant: 1 change
   - Next Day: 1 change
   - Short Term: 1 change
   - Long Term: 1 change
4. Confirm and save
5. Verify instant change applied immediately
6. Verify 3 changes in Scheduled Changes Panel
7. Check each has correct delay

**Success Criteria**:
- ✅ Changes grouped correctly
- ✅ Instant applied immediately
- ✅ All others scheduled
- ✅ Correct delays for each

---

## 🔧 Advanced Feature Tests

### Test 6: Change Cancellation
1. Schedule a medium-impact change (tax rate)
2. Go to Scheduled Changes Panel
3. Find the pending change
4. Click cancel button (trash icon)
5. Confirm cancellation
6. Verify change is removed from panel
7. Verify does not apply when scheduled time passes

**Success Criteria**:
- ✅ Cancel button works
- ✅ Change removed immediately
- ✅ Does not apply later

---

### Test 7: Change History
1. Create and apply some instant changes
2. Wait for or manually trigger cron job
3. Navigate to Scheduled Changes Panel
4. Click "History" tab
5. Verify past changes shown with:
   - Applied/cancelled status
   - Date applied
   - Old → new values

**Success Criteria**:
- ✅ History tab populated
- ✅ Status shown correctly
- ✅ Dates displayed
- ✅ Values shown

---

### Test 8: Warning Accuracy
**Test Economic Warnings**:

1. **Recession Warning**:
   - Set GDP growth to -2.0%
   - Verify: "⚠️ RECESSION: Economy will enter recession"

2. **High Inflation Warning**:
   - Set inflation to 15%
   - Verify: "⚠️ HIGH INFLATION: Inflation above 10% may destabilize economy"

3. **Critical Unemployment**:
   - Set unemployment to 20%
   - Verify: "⚠️ CRISIS: Unemployment above 15% indicates severe distress"

4. **High Debt Warning**:
   - Set debt-to-GDP to 110%
   - Verify: "⚠️ HIGH DEBT: Debt-to-GDP above 100% may affect credit rating"

**Success Criteria**:
- ✅ All warnings trigger correctly
- ✅ Thresholds accurate
- ✅ Messages clear and helpful

---

### Test 9: Large Magnitude Changes
1. Change GDP growth from 3% to 15%
2. Verify magnitude warning appears:
   - "⚠️ LARGE CHANGE: 400% change from current value"
3. Change unemployment from 5% to 25%
4. Verify similar magnitude warning

**Success Criteria**:
- ✅ Percentage change calculated correctly
- ✅ Warning appears for >50% change
- ✅ Exact percentage shown

---

## 🔄 Cron Job Tests

### Test 10: Manual Cron Trigger (Local)
```bash
# Run this in terminal
curl -X POST http://localhost:3000/api/cron/apply-scheduled-changes \
  -H "Authorization: Bearer your-secret"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Applied X changes with 0 errors",
  "result": {
    "appliedCount": X,
    "errorCount": 0,
    "affectedCountries": ["country-id"],
    "duration": 123
  }
}
```

**Success Criteria**:
- ✅ Endpoint responds
- ✅ Changes applied
- ✅ Countries updated
- ✅ Status changed to "applied"

---

### Test 11: Cron Job Stats
```bash
curl "http://localhost:3000/api/cron/apply-scheduled-changes?status=true"
```

**Expected Response**:
```json
{
  "status": "ok",
  "stats": {
    "total": 10,
    "pending": 5,
    "applied": 4,
    "cancelled": 1,
    "overdue": 2
  }
}
```

**Success Criteria**:
- ✅ Stats returned
- ✅ Counts accurate
- ✅ Timestamp included

---

### Test 12: Overdue Changes
1. Create a scheduled change
2. Manually set `scheduledFor` to yesterday (in database)
3. Trigger cron job
4. Verify change is applied
5. Check it moves to history

**Success Criteria**:
- ✅ Overdue changes detected
- ✅ Applied immediately
- ✅ Status updated

---

## 🎨 UI/UX Tests

### Test 13: Responsive Design
1. Open editor on desktop (1920px)
2. Verify 3-column + 1-column sidebar layout
3. Resize to tablet (768px)
4. Verify layout adjusts
5. Resize to mobile (375px)
6. Verify tabs stack, readable on small screen

**Success Criteria**:
- ✅ Desktop: Full layout with sidebar
- ✅ Tablet: Adjusted columns
- ✅ Mobile: Stacked, scrollable

---

### Test 14: Accessibility
1. Navigate editor using only keyboard (Tab key)
2. Verify all controls are reachable
3. Test with screen reader
4. Verify labels are read correctly
5. Check color contrast ratios

**Success Criteria**:
- ✅ Keyboard navigation works
- ✅ Focus indicators visible
- ✅ Screen reader compatible
- ✅ WCAG AA compliant

---

### Test 15: Loading States
1. Add artificial delay to API calls
2. Verify loading spinners appear
3. Check skeleton states show
4. Verify no flash of empty content

**Success Criteria**:
- ✅ Loading indicators present
- ✅ Graceful degradation
- ✅ No layout shift

---

### Test 16: Error Handling
1. Disconnect from internet
2. Try to save changes
3. Verify error message appears
4. Reconnect
5. Retry save
6. Verify success

**Success Criteria**:
- ✅ Errors caught and displayed
- ✅ User can retry
- ✅ No data loss

---

## 🔐 Security Tests

### Test 17: Authorization
1. Log out
2. Try to access `/mycountry/editor`
3. Verify redirected to login
4. Log in as different user
5. Try to access another user's country
6. Verify denied

**Success Criteria**:
- ✅ Auth required
- ✅ Can only edit own country
- ✅ Proper error messages

---

### Test 18: Cron Security
```bash
# Without secret
curl http://localhost:3000/api/cron/apply-scheduled-changes

# With wrong secret
curl -H "Authorization: Bearer wrong" \
  http://localhost:3000/api/cron/apply-scheduled-changes

# With correct secret
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/apply-scheduled-changes
```

**Success Criteria**:
- ✅ Without secret: Accepts (optional in dev)
- ✅ Wrong secret: Rejects with 401
- ✅ Correct secret: Accepts

---

## 📊 Performance Tests

### Test 19: Many Pending Changes
1. Create 20+ pending changes
2. Open Scheduled Changes Panel
3. Verify scrolling works smoothly
4. Check no lag when opening/closing

**Success Criteria**:
- ✅ Handles many changes
- ✅ Smooth scrolling
- ✅ No performance degradation

---

### Test 20: Concurrent Edits
1. Open editor in two browser tabs
2. Make different changes in each
3. Save from tab 1
4. Save from tab 2
5. Verify both sets of changes scheduled

**Success Criteria**:
- ✅ No conflicts
- ✅ All changes saved
- ✅ No data loss

---

## 🐛 Edge Case Tests

### Test 21: Duplicate Changes
1. Change GDP growth to 5.0%
2. Don't save
3. Change it again to 5.5%
4. Verify only one pending change (updated value)

**Success Criteria**:
- ✅ Duplicate prevented
- ✅ Latest value used
- ✅ No duplicate entries

---

### Test 22: Change Back to Original
1. Change country name to "New Name"
2. Review changes - shows 1 pending
3. Change back to original name
4. Verify change removed from pending

**Success Criteria**:
- ✅ Change auto-removed
- ✅ Pending count decreases
- ✅ Preview dialog empty

---

### Test 23: Invalid Values
1. Try to set GDP growth to 1000%
2. Try to set population to negative
3. Try to set inflation to non-numeric
4. Verify validation prevents/warns

**Success Criteria**:
- ✅ Invalid values caught
- ✅ Warnings shown
- ✅ Can't proceed without fix

---

## 📝 Test Report Template

```markdown
## Test Session: [Date]

**Tester**: [Name]
**Environment**: [Local/Staging/Production]
**Browser**: [Chrome/Firefox/Safari/Edge]

### Tests Passed: X/23

| Test # | Name | Status | Notes |
|--------|------|--------|-------|
| 1 | Instant Changes | ✅ PASS | |
| 2 | Low Impact | ✅ PASS | |
| 3 | Medium Impact | ✅ PASS | |
| ... | ... | ... | ... |

### Issues Found:
1. [Description]
2. [Description]

### Recommendations:
- [Suggestion]
- [Suggestion]
```

---

## 🎯 Minimum Viable Test Set

If time is limited, run these **essential tests**:

1. ✅ Test 1: Instant Changes
2. ✅ Test 4: High Impact Changes
3. ✅ Test 5: Multiple Changes
4. ✅ Test 6: Change Cancellation
5. ✅ Test 10: Manual Cron Trigger
6. ✅ Test 13: Responsive Design
7. ✅ Test 17: Authorization

**These cover**: Basic functionality, delays, cron, UI, and security.

---

## 🚀 Ready for Production

Once all tests pass:
- ✅ Deploy to staging
- ✅ Run full test suite again
- ✅ Monitor for 24 hours
- ✅ Deploy to production
- ✅ Monitor logs closely

**Good luck testing!** 🎉
