# Sick Leave Rules

## Overview

Sick leave operates differently from vacation leave - there is **NO 50/50 split**. All sick days are available throughout the entire employment cycle.

## Rules

### 1. Allocation
- **Default**: 7 sick days per employment cycle
- Can be customized in `leave_balances` table per employee
- Based on employment cycle (anniversary-based), not calendar year

### 2. Availability
- ✅ **Available anytime** during the employment cycle
- ✅ Can use all 7 days in first half
- ✅ Can use all 7 days in second half
- ✅ Can split across halves however needed
- ❌ **NO 50/50 restriction** (unlike vacation)

### 3. Validation
- System validates total sick leave used does not exceed allocation
- Checks against full cycle allocation (7 days by default)
- Does NOT check half-year restrictions

### 4. Rollover & Cashout
- ❌ Unused sick days do NOT roll over to next cycle
- ❌ Unused sick days are NOT cashable at cycle end
- Resets to full allocation at start of new employment cycle

## Technical Implementation

### Backend Validation
**File**: `server/src/routes/vacation.ts` (lines 557-630)

When a sick leave request is submitted:
1. Identifies if request is for sick leave type
2. Gets active employment cycle
3. Calculates total sick leave used in cycle
4. Checks if request would exceed total allocation
5. Blocks request if insufficient sick leave

```typescript
// Example validation logic
const totalSickLeaveUsed = sickLeaveRequests.reduce(
  (sum, req) => sum + parseFloat(req.daysCount),
  0
)

const remainingSickLeave = totalSickLeaveAllocation - totalSickLeaveUsed

if (daysCount > remainingSickLeave) {
  return res.status(400).json({
    error: `Insufficient sick leave. You have ${remainingSickLeave.toFixed(1)} days remaining...`
  })
}
```

### Balance Calculator
**File**: `server/src/utils/sickLeaveBalanceCalculator.ts`

Provides:
- `totalAllocated`: Total sick days for cycle (default 7)
- `totalUsed`: Sum of all approved sick leave in cycle
- `totalRemaining`: Available sick days
- `cycleStartDate`, `cycleEndDate`: Employment cycle boundaries

### API Endpoints

#### Get My Sick Leave Balance
```
GET /vacation/my-sick-leave-balance
Authorization: Required (Bearer token)
```

**Response**:
```json
{
  "totalAllocated": 7,
  "totalUsed": 2.5,
  "totalRemaining": 4.5,
  "cycleStartDate": "2025-09-01",
  "cycleEndDate": "2026-08-31",
  "cycleId": 17
}
```

## Comparison: Vacation vs Sick Leave

| Feature | Vacation Leave | Sick Leave |
|---------|---------------|------------|
| **Allocation** | 16/20/24 days (tiered) | 7 days (fixed) |
| **50/50 Split** | ✅ Yes - strict halves | ❌ No - full cycle |
| **First Half Limit** | 50% of total | 100% available |
| **Second Half Limit** | 50% of total | 100% available |
| **Rollover** | ❌ No | ❌ No |
| **Cashable** | ✅ Yes (up to 5 days) | ❌ No |
| **Will Expire** | ✅ Yes (beyond 5) | ✅ Yes (all unused) |
| **Based On** | Employment anniversary | Employment anniversary |

## Examples

### Example 1: Employee with cycle Sep 1 - Aug 31
- **Allocation**: 7 sick days
- **Scenario**: Uses 3 days in October (first half), 2 days in March (second half)
- **Result**: ✅ Allowed - 5 total days used, 2 remaining

### Example 2: Heavy usage in first half
- **Allocation**: 7 sick days
- **Scenario**: Uses 6 days in first half (Sep-Feb)
- **Result**: ✅ Allowed - only 1 day remaining for second half, but no restriction

### Example 3: All usage in second half
- **Allocation**: 7 sick days
- **Scenario**: Employee healthy in first half, uses all 7 days in second half (Mar-Aug)
- **Result**: ✅ Allowed - can use all days in any half

### Example 4: Exceeding allocation
- **Allocation**: 7 sick days
- **Scenario**: Already used 7 days, requests 1 more
- **Result**: ❌ Blocked - "Insufficient sick leave. You have 0 days remaining out of 7 days for this employment cycle."

## UI Display

Frontend can display sick leave balance using:

```typescript
import { api } from '@/lib/api'

// Get sick leave balance
const sickBalance = await api.getMySickLeaveBalance()

// Display
console.log(`Sick Leave: ${sickBalance.totalRemaining} / ${sickBalance.totalAllocated} days`)
```

## Database Setup

### Default Sick Leave Type
Ensure a sick leave type exists in `leave_types` table:

```sql
INSERT INTO leave_types (name, is_deductible, half_day_supported)
VALUES ('Sick Leave', true, true);
```

### Custom Allocations
To customize sick leave for specific employees:

```sql
INSERT INTO leave_balances (
  employee_id,
  employment_cycle_id,
  leave_type_id,
  allocated_days,
  adjustment_days
)
VALUES (
  12,  -- Jéssica
  17,  -- Her current cycle
  2,   -- Sick Leave type ID
  7,   -- Base allocation
  0    -- No adjustment
);
```

## Summary

Sick leave is intentionally simpler than vacation:
- **No complex rules** - just a total pool of days
- **Maximum flexibility** - use when needed, regardless of time of year
- **Clear boundary** - employment cycle (anniversary-based)
- **No financial component** - unused days simply expire

This design prioritizes employee health and wellbeing by removing barriers to taking sick leave when needed.
