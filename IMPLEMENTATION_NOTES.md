# Team Calendar - Interactive Vacation/Sick Leave Implementation

## Overview
This document describes the implementation of the interactive Team Calendar feature for managing vacation and sick leave requests. Admins can now click on any date in the calendar to add vacation/sick leave for team members, which is automatically approved and instantly displayed on the calendar.

## Features Implemented

### 1. Interactive Calendar View
- **Location**: `src/pages/admin/VacationPage.tsx` - Team Calendar Tab
- **Functionality**:
  - Monthly calendar grid showing all days
  - Color-coded leave types:
    - 🔵 Blue = Vacation
    - 🔴 Red = Sick Leave  
    - 🟡 Yellow = Other Leave
  - Click any date to open add leave modal
  - Navigation arrows to move between months
  - Today's date highlighted in blue
  - Multiple leave entries per day with "+X more" indicator
  - Employee names displayed on calendar

### 2. Quick Add Modal
When clicking a calendar date, a modal appears with:
- **Team Member Selection**: Searchable dropdown with autocomplete
- **Leave Type Selection**: Dropdown with all configured leave types
- **Date Range**: Start and end date pickers (can be same day for single-day leave)
- **Reason Field**: Optional text field for leave reason
- **Auto-Approval Notice**: Green banner confirming automatic approval
- **Action Buttons**: Cancel or Add Leave

### 3. Backend Endpoints

#### New Endpoint: `POST /api/vacation/admin/create-and-approve`
**Purpose**: Create and automatically approve leave requests from the admin calendar

**Request Body**:
```json
{
  "employeeId": 123,
  "leaveTypeId": 1,
  "startDate": "2025-01-15",
  "endDate": "2025-01-17",
  "reason": "Annual vacation",
  "autoApprove": true
}
```

**Features**:
- ✅ Admin-only endpoint (checks user.role === 'admin')
- ✅ Validates date ranges (start ≤ end)
- ✅ Checks for overlapping requests
- ✅ Calculates working days automatically
- ✅ Sets leave status to "approved" when `autoApprove: true`
- ✅ Sets decision details (decisionBy, decisionAt, decisionReason)
- ✅ Creates audit trail event with auto-approval note

**Response**: Returns the created leave request object with status "approved"

**Error Handling**:
- 403: User is not an admin
- 400: Invalid date range or overlapping request exists
- 500: Server error

#### Existing Endpoint Enhanced: `GET /api/vacation/calendar-events`
**Purpose**: Fetch all approved leave requests for calendar display

**Response**:
```json
[
  {
    "id": 1,
    "employeeId": 123,
    "employeeName": "John Doe",
    "leaveType": "Vacation",
    "startDate": "2025-01-15",
    "endDate": "2025-01-17",
    "status": "approved",
    "daysCount": "3",
    "halfDayStart": false,
    "halfDayEnd": false
  }
]
```

**Features**:
- Only returns approved requests
- Joins with teamMembers and leaveTypes tables
- Ordered by startDate descending
- Includes all day-range metadata for display

## Frontend Components

### State Management (VacationPage.tsx)
```typescript
const [currentMonth, setCurrentMonth] = useState(new Date())
const [showCalendarModal, setShowCalendarModal] = useState(false)
const [selectedDate, setSelectedDate] = useState<string>('')
const [calendarFormData, setCalendarFormData] = useState({
  employeeId: '',
  leaveTypeId: '',
  startDate: '',
  endDate: '',
  reason: '',
})
const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
```

### Key Functions
- `handleDateClick(date)`: Opens modal with pre-filled date
- `handleAddLeave()`: Validates form and submits to API
- `getCalendarDayEvents(date)`: Filters approved requests for display
- `createLeaveMutation`: TanStack React Query mutation for API call

### Queries Used
1. `useQuery(['leaveRequests'])` - Fetch all leave requests
2. `useQuery(['teamMembers'])` - Fetch team members list
3. `useQuery(['leaveTypes'])` - Fetch leave type definitions
4. `useMutation()` - Create and approve leave request

## Data Flow

```
User clicks date on calendar
    ↓
Modal opens with date pre-filled
    ↓
User selects employee and leave type
    ↓
User optionally adds reason
    ↓
User clicks "Add Leave"
    ↓
POST /api/vacation/admin/create-and-approve
    ↓
Backend validates and creates approved request
    ↓
Audit trail event created
    ↓
Frontend refreshes leaveRequests query
    ↓
Calendar updates with new leave showing
    ↓
Modal closes and form resets
```

## Validation & Error Handling

### Frontend
- Employee and leave type are required
- Shows alert on validation errors
- Displays "Adding..." state during submission
- Disables submit button during loading

### Backend
- Date range validation (start ≤ end)
- Overlapping request detection
- Admin role verification
- Database transaction safety
- Detailed error messages in responses

## Display Logic

### Calendar Grid Cell
Each day cell shows:
1. Date number (top-left)
2. Up to 2 leave entries (colored badges with employee names)
3. "+X more" indicator if >2 entries
4. Tooltip showing full details on hover

### Color Coding
- Determined by `leaveType.name` field
- Vacation → Blue (#3B82F6)
- Sick Leave → Red (#EF4444)
- Other → Yellow (#ECD34D)

### Today Highlighting
- Today's cell has blue background and border
- Hover effect for better UX

## Testing Workflow

1. **Add Single Day Leave**:
   - Click a date
   - Select employee
   - Select leave type
   - Click "Add Leave"
   - Verify it appears on calendar

2. **Add Multi-Day Leave**:
   - Click a date
   - Set different start and end dates
   - Verify full range shows on calendar

3. **Overlapping Detection**:
   - Try to add overlapping leave
   - Should show error: "Overlapping leave request exists"

4. **Navigation**:
   - Use arrow buttons to navigate months
   - Calendar should update correctly
   - Old leaves should still display when scrolling

5. **Auto-Approval**:
   - Verify new leaves show as "approved" (not pending)
   - Check audit trail in database
   - Verify green notification in modal

## Performance Considerations

- Calendar events fetched with approved-only filter
- Uses React Query for caching
- Optimistic UI updates possible (not yet implemented)
- Bulk operations use batch queries

## Future Enhancements

1. **Half-Day Support**:
   - Add checkboxes for half-day start/end
   - Update calendar display for half-days

2. **Recurring Leave**:
   - Option to set recurring vacation/leave
   - Pattern definition (weekly, monthly, etc.)

3. **Conflict Warnings**:
   - Warning if multiple team members on leave same day
   - Project impact warnings

4. **Export/Reports**:
   - Export calendar to PDF/Excel
   - Team coverage reports
   - Trend analysis

5. **Email Notifications**:
   - Auto-notify employee when leave added
   - Team notifications for coverage planning

## Database Schema
Uses existing tables:
- `leave_requests` - Main leave request records
- `leave_request_events` - Audit trail
- `team_members` - Employee information
- `leave_types` - Leave type definitions (Vacation, Sick Leave, etc.)

## Files Modified

1. **Frontend**:
   - `src/pages/admin/VacationPage.tsx` - Added interactive calendar and modal

2. **Backend**:
   - `server/src/routes/vacation.ts` - Added two new endpoints

3. **Configuration**:
   - `.cursorrules` - Updated with calendar testing instructions

## Browser Compatibility
- ✅ Chrome/Edge (Latest)
- ✅ Firefox (Latest)
- ✅ Safari (Latest)
- Responsive design works on tablets (min-width: 640px recommended)

