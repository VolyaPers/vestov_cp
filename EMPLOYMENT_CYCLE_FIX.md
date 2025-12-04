# Employment Cycle Fix: Calendar Year → Anniversary-Based

## Problem Identified

The vacation system was using **calendar year-based cycles** (January 1 - December 31) instead of **employment anniversary-based cycles** (based on each employee's start date).

### Example: Jéssica Ferreira
- **Start date**: September 1, 2025
- **Old cycle**: January 1, 2025 - December 31, 2025
  - **Old midpoint**: July 1, 2025 (calendar-based)
- **New cycle**: September 1, 2025 - August 31, 2026
  - **New midpoint**: March 1, 2026 (6 months after start)

This caused the "first half" and "second half" to be based on calendar months rather than employment anniversaries, which was incorrect.

## Root Cause

1. **Missing `cycleMidpoint` in cycle creation**: The POST endpoints that create employment cycles were not calculating or inserting the `cycleMidpoint` field
2. **Calendar year setup**: Employment cycles were being created with calendar year dates (Jan 1 - Dec 31) instead of anniversary dates

## Fixes Applied

### 1. Fixed Cycle Creation Endpoints
Updated both cycle creation endpoints to calculate and insert `cycleMidpoint`:

**File**: `server/src/routes/vacation.ts`
- **Line 1194-1197**: Added midpoint calculation for `/cycles/initialize` endpoint
- **Line 1454-1457**: Added midpoint calculation for `/admin/cycles` endpoint

```typescript
// Calculate midpoint (6 months from start) for 50/50 vacation split
const midpointDate = new Date(startDate)
midpointDate.setMonth(startDate.getMonth() + 6)
const cycleMidpoint = midpointDate.toISOString().split('T')[0]
```

### 2. Created Migration Script
**File**: `server/src/scripts/fix-employment-cycles-to-anniversary.ts`

This script:
- Gets each team member's start date from `team_members.start_date`
- Calculates anniversary-based cycle dates:
  - `cycleStart` = start date anniversary for current year
  - `cycleMidpoint` = 6 months after cycle start
  - `cycleEnd` = 1 year minus 1 day after cycle start
- Updates all employment cycles to use anniversary-based dates

### 3. Executed Migration
Ran the migration script successfully, converting 7 employment cycles from calendar year to anniversary-based:

```
✅ Carol Davis: 2025-01-01 → 2025-01-20 (anniversary-based)
✅ David Brown: 2025-01-01 → 2025-03-01 (anniversary-based)
✅ Sarah Miller: 2025-01-01 → 2025-01-15 (anniversary-based)
✅ Michael Chen: 2025-01-01 → 2025-03-01 (anniversary-based)
✅ Jéssica Ferreira: 2025-01-01 → 2025-09-01 (anniversary-based)
✅ Sergei Vasilenko: 2024-09-01 → 2025-01-21 (anniversary-based)
✅ Alice Johnson: 2025-01-01 → 2025-01-15 (anniversary-based)
```

## Verification

### Before Fix
```sql
SELECT * FROM employment_cycles WHERE employee_id = 12; -- Jéssica
-- Result: cycle_start='2025-01-01', cycle_midpoint='2025-07-01', cycle_end='2025-12-31'
```

### After Fix
```sql
SELECT * FROM employment_cycles WHERE employee_id = 12; -- Jéssica
-- Result: cycle_start='2025-09-01', cycle_midpoint='2026-03-01', cycle_end='2026-08-31'
```

## How It Works Now

The vacation balance calculator (`server/src/utils/vacationBalanceCalculator.ts`) already had the correct logic:

```typescript
// Line 97: Determine which half we're in
const isFirstHalf = currentDate < cycleMidpoint

// Line 153-154: Split requests by half based on start date
const firstHalfRequests = requests.filter(r => new Date(r.startDate) < cycleMidpoint)
const secondHalfRequests = requests.filter(r => new Date(r.startDate) >= cycleMidpoint)
```

Now that `cycleMidpoint` is correctly set to the employee's anniversary + 6 months, the 50/50 vacation split works as intended:

- **First half**: Employment anniversary → Anniversary + 6 months
- **Second half**: Anniversary + 6 months → Next anniversary

## Future Cycle Creation

When creating new employment cycles through the admin interface:
1. Set `cycleStart` to the employee's start date anniversary
2. The system will automatically calculate:
   - `cycleMidpoint` = cycleStart + 6 months
   - `cycleEnd` = cycleStart + 1 year - 1 day

## Scripts Available

### Fix Employment Cycles
```bash
cd server
npx tsx src/scripts/fix-employment-cycles-to-anniversary.ts
```

This script is **idempotent** - it checks if cycles are already anniversary-based and skips them if so.

### Fix Cycle Midpoints
```bash
cd server
npx tsx src/scripts/fix-cycle-midpoints.ts
```

This script calculates missing `cycleMidpoint` values for any cycles that don't have them set.

## Summary

The system now correctly uses **employment anniversary-based cycles** instead of calendar years:

- ✅ Each employee's vacation year starts on their employment anniversary
- ✅ First half = anniversary to anniversary + 6 months
- ✅ Second half = anniversary + 6 months to next anniversary
- ✅ Strict 50/50 split with no rollover between halves
- ✅ Unused days tracked for cashout/expiry at cycle end
