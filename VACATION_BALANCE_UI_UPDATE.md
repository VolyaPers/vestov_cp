# Vacation Balance UI Update - Sick Leave Integration

## Overview

Updated the VacationBalanceCard component to display sick leave information alongside vacation balance, emphasizing that all 7 sick days are available throughout the entire employment cycle with no 50/50 restriction.

## Changes Made

### File Modified
`src/components/VacationBalanceCard.tsx`

### New Features

#### 1. Sick Leave Balance Query
- Added React Query hook to fetch sick leave balance from API
- Fetches data automatically when vacation balance is loaded
- Handles loading and error states

```typescript
const { data: sickLeaveBalance, isLoading: sickLeaveLoading } = useQuery<SickLeaveBalance>({
  queryKey: ['sickLeaveBalance'],
  queryFn: () => api.getMySickLeaveBalance(),
  enabled: !isLoading && !error && !!balance,
})
```

#### 2. Sick Leave Display Section
Added comprehensive sick leave information at the bottom of the vacation balance card:

**a) Section Header**
- Activity icon (📊) to distinguish from vacation
- "Sick Leave" title
- Info tooltip explaining no 50/50 restriction

**b) Available Days - Big Number Display**
- Large prominent display of remaining sick days
- Blue color scheme (different from vacation's primary color)
- Shows "X out of 7 total" format

**c) Educational Banner**
- Green background to emphasize positive/flexible message
- Heart icon
- Clear explanation: "All 7 sick days are available anytime during your employment cycle"
- Emphasizes difference from vacation (no first/second half restrictions)
- Employment cycle dates displayed

**d) Usage Summary Grid**
- Three-column layout showing:
  - **Allocated**: Total sick days (7)
  - **Used**: Days taken (orange color)
  - **Remaining**: Days available (green color)

#### 3. Loading State
- Displays spinner with "Loading sick leave..." message while fetching data
- Doesn't block display of vacation balance

## UI Layout

```
┌─────────────────────────────────────────┐
│ Vacation Balance (Existing)             │
│ - Available Now: X days                 │
│ - 50/50 Split Info                     │
│ - First Half / Second Half Breakdown   │
│ - Locked Days Warning (if applicable)   │
│ - Financial Summary                     │
│ - Total Summary                         │
├─────────────────────────────────────────┤ ← New Border Separator
│ Sick Leave (NEW)                        │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │   Sick Days Available             │  │
│ │         7.0 days                  │  │ ← Big Number Display
│ │   out of 7 total                  │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ ♥ Full Cycle Availability         │  │
│ │ All 7 sick days available anytime│  │ ← Educational Message
│ │ during your employment cycle      │  │
│ │ (Sep 1, 2025 - Aug 31, 2026)     │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Allocated │  Used  │ Remaining   │  │
│ │     7     │  0.0   │    7.0      │  │ ← Usage Grid
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Key Messages Emphasized

### 1. No 50/50 Restriction
The UI clearly communicates through multiple means:
- Tooltip: "Sick leave is available throughout the entire employment cycle with no 50/50 split restriction"
- Educational banner: "Unlike vacation days, **all 7 sick days are available anytime**"
- Banner text: "There are no first-half or second-half restrictions"

### 2. Full Cycle Availability
- Shows employment cycle dates
- Emphasizes "Full Cycle Availability" as the header
- Uses positive/encouraging language: "Use them whenever you need for your health and recovery"

### 3. Visual Differentiation
- **Vacation**: Primary color (purple/blue), Calendar icon
- **Sick Leave**: Blue/green colors, Activity icon
- Clear visual separation with border
- Different banner colors (blue for vacation education, green for sick leave)

## Integration Points

### API Endpoint
- `GET /vacation/my-sick-leave-balance`
- Returns: `{ totalAllocated, totalUsed, totalRemaining, cycleStartDate, cycleEndDate, cycleId }`

### React Query
- Query key: `['sickLeaveBalance']`
- Automatically refetches on focus/mount
- Handles caching

### Error Handling
- If sick leave fetch fails, section is simply not displayed
- Doesn't break vacation balance display
- Loading state shown while fetching

## User Experience Benefits

1. **All Information in One Place**: Users see both vacation and sick leave balances in a single card
2. **Clear Differentiation**: Visual and textual cues make it obvious these are different leave types with different rules
3. **Educational**: Users learn the rules through the UI itself
4. **Actionable**: Shows exactly how many days are available and when
5. **Transparent**: Full breakdown of allocation, usage, and remaining days

## Technical Implementation

### TypeScript Interfaces
```typescript
interface SickLeaveBalance {
  totalAllocated: number
  totalUsed: number
  totalRemaining: number
  cycleStartDate: string
  cycleEndDate: string
  cycleId: number
}
```

### Dependencies
- `@tanstack/react-query` for data fetching
- `lucide-react` for Activity and Heart icons
- Existing UI components (Card, Tooltip)
- Existing API client (`api.getMySickLeaveBalance()`)

## Future Enhancements

Potential improvements:
1. Show recent sick leave requests
2. Add sick leave request button directly from this card
3. Show warning when sick leave is running low
4. Display sick leave history/trends
5. Integration with calendar to show scheduled sick days

## Testing

To test the new feature:
1. Navigate to vacation/leave management page
2. Verify sick leave section appears below vacation balance
3. Check that "7 days available anytime" message is clear
4. Hover over info icon to see tooltip
5. Verify usage numbers are accurate
6. Test with employee who has used some sick leave
7. Test loading state by throttling network
