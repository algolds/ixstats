# Builder Production Validation Checklist

## ✅ **Pre-Launch Validation - Complete Builder Flow Test**

Use this checklist to validate the builder system from scratch to ensure all data points are properly editable, configurable, and persist correctly in production.

---

## 🧪 **Test Scenario: Create New Country from Scratch**

### **Step 1: Foundation Selection** ⏱️ 2 minutes

**Actions**:
1. Navigate to `/builder`
2. Click "Start Building"
3. Search for a foundation country (e.g., "Norway")
4. Select the country
5. Review the country preview card

**Validation**:
- [ ] Country search works properly
- [ ] Foundation country data displays correctly (GDP, population, flag)
- [ ] "Continue to Customize" button is enabled
- [ ] Country data is loaded into builder state

**Data Points Captured**:
- Foundation country name
- Baseline population (from foundation)
- Baseline GDP per capita (from foundation)
- Continent, region, land area
- Flag URL (optional)

---

### **Step 2: National Identity Configuration** ⏱️ 5 minutes

**Actions**:
1. Enter custom country name (e.g., "New Valhalla")
2. Select government type (e.g., "Constitutional Monarchy")
3. Fill in identity fields:
   - Official Name (auto-generated or custom)
   - Motto & Motto (Native)
   - Capital City
   - Largest City
   - Demonym
   - Currency & Currency Symbol
   - Official Languages
   - National Language
   - National Anthem
   - National Day
   - Calling Code
   - Internet TLD
   - Driving Side
   - Time Zone
   - ISO Code
   - Coordinates (Latitude/Longitude)
   - Emergency Number
   - Postal Code Format
   - National Sport
   - Week Start Day
4. Upload flag image (optional)
5. Upload coat of arms image (optional)

**Validation**:
- [ ] All text inputs accept and save data
- [ ] Government type selector works
- [ ] Currency symbol picker works
- [ ] Dropdown selectors (driving side, week start) work
- [ ] Flag/coat of arms upload or URL input works
- [ ] Official name auto-generates based on government type
- [ ] Demonym auto-suggests based on country name

**Data Points Captured** (27 fields):
- ✅ All 27 national identity fields listed above
- ✅ Flag URL, Coat of Arms URL

---

### **Step 3: Core Economic Indicators** ⏱️ 3 minutes

**Actions**:
1. Adjust Total Population (slider or number input)
2. Adjust GDP per Capita
3. Verify Nominal GDP auto-calculates (population × GDP per capita)
4. Set Real GDP Growth Rate (%)
5. Set Inflation Rate (%)
6. Set Currency Exchange Rate
7. Optionally set Gini Coefficient

**Validation**:
- [ ] Population slider works (100K - 2B range)
- [ ] GDP per capita adjusts properly
- [ ] Nominal GDP auto-calculates correctly
- [ ] Growth rate and inflation inputs accept values
- [ ] Economic tier badge updates based on GDP per capita
- [ ] Population tier badge updates based on population
- [ ] Comparison with foundation country displays

**Data Points Captured** (7 fields):
- ✅ Total Population
- ✅ Nominal GDP (calculated)
- ✅ GDP per Capita
- ✅ Real GDP Growth Rate
- ✅ Inflation Rate
- ✅ Currency Exchange Rate
- ✅ Gini Coefficient

---

### **Step 4: Labor & Employment** ⏱️ 3 minutes

**Actions**:
1. Set Labor Force Participation Rate (%)
2. Set Employment Rate (%)
3. Set Unemployment Rate (%)
4. Verify Total Workforce auto-calculates
5. Set Average Workweek Hours
6. Set Minimum Wage
7. Set Average Annual Income
8. Toggle Labor Protections (on/off)

**Validation**:
- [ ] All sliders and number inputs work
- [ ] Total workforce calculates from population × participation rate
- [ ] Employment + Unemployment = 100% (validation)
- [ ] Wage inputs accept currency values
- [ ] Toggle switches work

**Data Points Captured** (8 fields):
- ✅ Labor Force Participation Rate
- ✅ Employment Rate
- ✅ Unemployment Rate
- ✅ Total Workforce (calculated)
- ✅ Average Workweek Hours
- ✅ Minimum Wage
- ✅ Average Annual Income
- ✅ Labor Protections (boolean)

---

### **Step 5: Fiscal System** ⏱️ 5 minutes

**Actions**:
1. Set Tax Revenue as % of GDP
2. Verify Government Revenue Total calculates
3. Verify Tax Revenue Per Capita calculates
4. Set Government Budget as % of GDP
5. Observe Budget Deficit/Surplus calculation
6. Set Internal Debt as % of GDP
7. Set External Debt as % of GDP
8. Verify Total Debt Ratio calculates
9. Set Interest Rates (%)
10. Observe Debt Service Costs calculation
11. Set Income Tax Rate (%)
12. Set Corporate Tax Rate (%)
13. Set Sales Tax Rate (%)
14. Toggle Progressive Taxation
15. Toggle Balanced Budget Rule
16. Set Debt Ceiling (%)
17. Toggle Anti-Avoidance Measures

**Validation**:
- [ ] Tax inputs work and calculate totals
- [ ] Debt calculations are correct
- [ ] Interest and service costs auto-calculate
- [ ] Tax rate inputs accept percentages
- [ ] Policy toggles work
- [ ] Fiscal health indicators update

**Data Points Captured** (19 fields):
- ✅ Tax Revenue GDP Percent
- ✅ Government Revenue Total (calculated)
- ✅ Tax Revenue Per Capita (calculated)
- ✅ Government Budget GDP Percent
- ✅ Budget Deficit/Surplus (calculated)
- ✅ Internal Debt GDP Percent
- ✅ External Debt GDP Percent
- ✅ Total Debt GDP Ratio (calculated)
- ✅ Debt Per Capita (calculated)
- ✅ Interest Rates
- ✅ Debt Service Costs (calculated)
- ✅ Income Tax Rate
- ✅ Corporate Tax Rate
- ✅ Sales Tax Rate
- ✅ Progressive Taxation (boolean)
- ✅ Balanced Budget Rule (boolean)
- ✅ Debt Ceiling
- ✅ Anti-Avoidance (boolean)
- ✅ Tax Rates (complex structure)

---

### **Step 6: Demographics** ⏱️ 4 minutes

**Actions**:
1. Adjust Age Distribution sliders (0-15, 16-64, 65+)
2. Set Life Expectancy
3. Adjust Urban/Rural Split
4. Set Literacy Rate (%)
5. Adjust Education Levels distribution
6. Set Population Growth Rate (%)

**Validation**:
- [ ] Age distribution sliders total to 100%
- [ ] Life expectancy input works
- [ ] Urban/rural split totals to 100%
- [ ] Literacy rate slider works
- [ ] Education level sliders work
- [ ] Growth rate accepts decimal values

**Data Points Captured** (8 fields):
- ✅ Age Distribution (3 groups)
- ✅ Life Expectancy
- ✅ Urban/Rural Split (2 values)
- ✅ Literacy Rate
- ✅ Education Levels (5 levels)
- ✅ Population Growth Rate

---

### **Step 7: Government Spending** ⏱️ 4 minutes

**Actions**:
1. Set total government spending (or use calculated default)
2. Adjust spending allocation by category:
   - Defense (%)
   - Education (%)
   - Healthcare (%)
   - Infrastructure (%)
   - Social Security (%)
   - Other (%)
3. Verify percentages total to 100%
4. Verify spending amounts calculate from total budget
5. Toggle Performance-Based Budgeting
6. Toggle Green Investment Priority
7. Toggle Digital Government Initiative

**Validation**:
- [ ] Spending sliders work
- [ ] Total budget displays correctly
- [ ] Category percentages total to 100%
- [ ] Amounts calculate from percentages × total budget
- [ ] Policy toggles work
- [ ] Spending pie chart updates

**Data Points Captured** (13 fields):
- ✅ Total Spending (calculated from GDP)
- ✅ Spending GDP Percent
- ✅ Spending Per Capita (calculated)
- ✅ Defense Spending (amount + percent)
- ✅ Education Spending (amount + percent)
- ✅ Healthcare Spending (amount + percent)
- ✅ Infrastructure Spending (amount + percent)
- ✅ Social Security Spending (amount + percent)
- ✅ Other Spending (amount + percent)
- ✅ Performance-Based Budgeting (boolean)
- ✅ Green Investment Priority (boolean)
- ✅ Digital Government Initiative (boolean)
- ✅ Deficit/Surplus (calculated)

---

### **Step 8: Income & Wealth Distribution** ⏱️ 2 minutes

**Actions**:
1. Adjust Economic Classes distribution (if available)
2. Set Poverty Rate (%)
3. Set Income Inequality (Gini)
4. Set Social Mobility Index

**Validation**:
- [ ] Class distribution inputs work
- [ ] Poverty rate slider works
- [ ] Gini coefficient input accepts values (0-1)
- [ ] Social mobility index accepts values (0-100)

**Data Points Captured** (4 fields):
- ✅ Economic Classes (5 classes with population/wealth %)
- ✅ Poverty Rate
- ✅ Income Inequality Gini
- ✅ Social Mobility Index

---

### **Step 9: Preview & Review** ⏱️ 2 minutes

**Actions**:
1. Navigate to Preview step
2. Review all entered data in preview panel
3. Check economic health indicators (vitality rings)
4. Verify all sections show green checkmarks
5. Review country summary card

**Validation**:
- [ ] All sections marked as complete
- [ ] Preview displays correct country name and data
- [ ] Economic vitality rings display
- [ ] Health score calculates
- [ ] Tier badges display correctly
- [ ] No missing data warnings

**Data Points Validated**:
- ✅ All 88 fields reviewed in preview
- ✅ Calculated metrics (GDP, tiers, health) accurate

---

### **Step 10: Create Country** ⏱️ 1 minute

**Actions**:
1. Click "Create Nation" button
2. Wait for creation process (loading state)
3. Observe redirect to MyCountry dashboard

**Validation**:
- [ ] Loading state shows during creation
- [ ] No errors in console or UI
- [ ] Successfully redirects to `/mycountry`
- [ ] User is automatically logged in
- [ ] Country appears in user profile

**API Validation**:
- [ ] `countries.createCountry` mutation called successfully
- [ ] 200 OK response received
- [ ] Country ID returned
- [ ] User linked to country

---

## 📊 **Step 11: MyCountry Dashboard Verification** ⏱️ 5 minutes

**Actions**:
1. Navigate to MyCountry dashboard (`/mycountry`)
2. Verify country name displays
3. Check flag and coat of arms display
4. Review each dashboard section:
   - **Intelligence Dashboard**
   - **Economic Overview**
   - **Demographics Panel**
   - **Fiscal & Budget**
   - **National Identity**

**Validation**:

### **Intelligence Dashboard**:
- [ ] Economic vitality ring displays with correct value
- [ ] Population wellbeing displays
- [ ] Government efficiency displays
- [ ] Diplomatic standing displays (default value OK)
- [ ] Critical alerts section visible

### **Economic Overview**:
- [ ] Current population displays correctly
- [ ] Current GDP per capita displays
- [ ] Current total GDP displays (calculated)
- [ ] Real GDP growth rate displays
- [ ] Inflation rate displays
- [ ] Economic tier badge shows correct tier
- [ ] Unemployment rate displays

### **Demographics Panel**:
- [ ] Age distribution chart displays
- [ ] Urban/rural split displays
- [ ] Life expectancy displays
- [ ] Literacy rate displays
- [ ] Education levels chart displays

### **Fiscal & Budget**:
- [ ] Tax revenue displays
- [ ] Government spending displays
- [ ] Budget deficit/surplus displays
- [ ] Total debt displays
- [ ] Spending by category pie chart displays
- [ ] All 6 spending categories visible

### **National Identity**:
- [ ] Flag displays (uploaded or foundation)
- [ ] Coat of arms displays
- [ ] All 27 identity fields visible:
  - Country Name
  - Official Name
  - Government Type
  - Motto & Motto Native
  - Capital City
  - Largest City
  - Demonym
  - Currency & Symbol
  - Official Languages
  - National Language
  - National Anthem
  - National Day
  - Calling Code
  - Internet TLD
  - Driving Side
  - Time Zone
  - ISO Code
  - Coordinates
  - Emergency Number
  - Postal Code Format
  - National Sport
  - Week Start Day

**Data Verification**:
- [ ] All builder-entered data matches MyCountry display
- [ ] No missing fields
- [ ] No placeholder/default values where custom data was entered
- [ ] Calculated fields (GDP, totals) are accurate

---

## 🗄️ **Step 12: Database Verification** ⏱️ 3 minutes

**Actions** (for admin/developer testing):
1. Query the database for the created country
2. Verify records in all related tables

**Tables to Check**:
- [ ] **Country** table - Main record exists with all fields
- [ ] **NationalIdentity** table - Linked record with 27 fields
- [ ] **Demographics** table - Age distribution, education, etc.
- [ ] **FiscalSystem** table - Tax rates and policies
- [ ] **LaborMarket** table - Employment data
- [ ] **IncomeDistribution** table - Wealth distribution
- [ ] **GovernmentBudget** table - Spending by category
- [ ] **HistoricalDataPoint** table - Initial snapshot created
- [ ] **User** table - countryId linked to user

**SQL Validation Queries**:
```sql
-- Main country record
SELECT * FROM Country WHERE name = 'New Valhalla';

-- Verify all related records exist
SELECT 
  (SELECT COUNT(*) FROM NationalIdentity WHERE countryId = c.id) as nat_id_count,
  (SELECT COUNT(*) FROM Demographics WHERE countryId = c.id) as demo_count,
  (SELECT COUNT(*) FROM FiscalSystem WHERE countryId = c.id) as fiscal_count,
  (SELECT COUNT(*) FROM LaborMarket WHERE countryId = c.id) as labor_count,
  (SELECT COUNT(*) FROM IncomeDistribution WHERE countryId = c.id) as income_count,
  (SELECT COUNT(*) FROM GovernmentBudget WHERE countryId = c.id) as budget_count,
  (SELECT COUNT(*) FROM HistoricalDataPoint WHERE countryId = c.id) as history_count
FROM Country c WHERE c.name = 'New Valhalla';

-- Verify user linkage
SELECT u.id, u.clerkUserId, u.countryId, c.name 
FROM User u 
JOIN Country c ON u.countryId = c.id 
WHERE c.name = 'New Valhalla';
```

**Expected Results**:
- [ ] All counts = 1 (one record per related table)
- [ ] User.countryId matches Country.id
- [ ] HistoricalDataPoint has initial snapshot

---

## ✅ **Step 13: Edit & Update Verification** ⏱️ 3 minutes

**Actions**:
1. Navigate to MyCountry Editor (`/mycountry/editor`)
2. Make a change to any field (e.g., increase GDP growth rate)
3. Save changes
4. Verify update persists in database
5. Return to MyCountry dashboard
6. Verify changed value displays

**Validation**:
- [ ] Editor loads with current country data
- [ ] All sections editable
- [ ] Changes can be saved
- [ ] Database updates correctly
- [ ] MyCountry dashboard reflects changes
- [ ] No data loss on update

---

## 📝 **Summary Checklist**

### **Data Coverage**: 88/88 Fields ✅
- [ ] National Identity: 27 fields
- [ ] Core Indicators: 7 fields
- [ ] Labor & Employment: 8 fields
- [ ] Fiscal System: 19 fields
- [ ] Demographics: 8 fields
- [ ] Income & Wealth: 4 fields
- [ ] Government Spending: 13 fields
- [ ] Geography: 2 fields

### **Database Tables**: 9 Tables ✅
- [ ] Country
- [ ] NationalIdentity
- [ ] Demographics
- [ ] FiscalSystem
- [ ] LaborMarket
- [ ] IncomeDistribution
- [ ] GovernmentBudget
- [ ] HistoricalDataPoint
- [ ] User (linkage)

### **CRUD Operations**: All Working ✅
- [ ] **Create**: Country creation from builder
- [ ] **Read**: MyCountry dashboard displays data
- [ ] **Update**: Editor can modify fields
- [ ] **Delete**: (User can unlink/delete if needed)

### **Integration**: Full Alignment ✅
- [ ] Builder → Database: All fields persist
- [ ] Database → MyCountry: All fields display
- [ ] No data loss in any step
- [ ] Transaction atomicity maintained

---

## 🎯 **Success Criteria**

✅ **PASS**: All checkboxes above are checked  
✅ **PASS**: No errors in console logs  
✅ **PASS**: All 88 fields editable and persist correctly  
✅ **PASS**: MyCountry dashboard displays all builder data  
✅ **PASS**: Database has all related records  
✅ **PASS**: User properly linked to created country  

---

## 🚨 **Common Issues & Troubleshooting**

### **Issue**: Field not saving
**Check**:
- Is the field in the `EconomicInputs` interface?
- Is it being extracted in `countries.createCountry` mutation?
- Is it mapped to correct database field?
- Review `BUILDER_DATA_COVERAGE.md` for field mapping

### **Issue**: Data not displaying in MyCountry
**Check**:
- Is the data actually saved in database? (Check with SQL)
- Is MyCountry query including the related table? (Check Prisma include)
- Is the component reading from correct data structure?

### **Issue**: Creation fails with error
**Check**:
- Console logs for specific error
- Database constraints (required fields, unique constraints)
- User authentication (is user logged in?)
- Network tab for API response details

---

## 📊 **Expected Completion Time**

- **Full Test**: 30-40 minutes
- **Quick Test** (skip optional fields): 15-20 minutes
- **Database Verification**: 5 minutes
- **Total**: ~45 minutes for comprehensive validation

---

## ✅ **Production Readiness Certification**

After completing this checklist:

**I certify that**:
- [ ] Builder system is fully functional
- [ ] All 88 data fields are editable and configurable
- [ ] CRUD operations work correctly in production
- [ ] Data properly persists to all 9 database tables
- [ ] MyCountry dashboard displays all builder data
- [ ] No data loss between builder and database
- [ ] System ready for production deployment

**Tested By**: _____________  
**Date**: _____________  
**Environment**: Production / Staging  
**Status**: ✅ PASS / ❌ FAIL  

---

**For issues or questions, see**: `BUILDER_DATA_COVERAGE.md`

