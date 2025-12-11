# Leave Allocation Rules

## Vacation Days Allocation

The vacation days are allocated based on the employee's employment cycle (year):

- **First Year (Cycle 1)**: 15 vacation days
- **Second Year (Cycle 2)**: 20 vacation days
- **Third Year and Beyond (Cycle 3+)**: 25 vacation days

## Sick Leave Allocation

Sick leave is allocated uniformly across all employment cycles:

- **All Years**: 7 sick leave days per year

## Implementation

The allocation rules are stored in the `leave_allocation_settings` table and automatically applied when:

1. Creating new employment cycles via the admin panel
2. Running the setup script (`server/src/scripts/setup-vacation-data.ts`)

### Database Configuration

Current allocation settings:

```sql
-- Vacation allocations
Cycle 1: 15.0 days
Cycle 2: 20.0 days
Cycle 3+: 25.0 days (default for all subsequent cycles)

-- Sick Leave allocations
All Cycles: 7.0 days (default)
```

## How It Works

When a new employment cycle is created:

1. The system determines which cycle number this is for the employee (1st, 2nd, 3rd, etc.)
2. It looks up the appropriate allocation from `leave_allocation_settings` based on:
   - Cycle number
   - Leave type (Vacation, Sick Leave, etc.)
3. If no specific cycle setting exists, it uses the default setting (`is_default = true`)
4. Leave balances are automatically created with the allocated days

## Automatic Cycle Renewal

Employment cycles are designed to:
- Last exactly one year from the start date
- Automatically calculate the end date as start date + 1 year
- Reset leave balances when a new cycle is created
- Increment the cycle number to determine the correct allocation tier

## Current Status

All active team members currently have:
- Employment Cycle 1 (First Year)
- 15 vacation days allocated
- 7 sick leave days allocated

Future cycles will automatically receive the appropriate allocation based on the cycle number.
