# Team Calendar - Testing Guide

## Quick Start

### Prerequisites
- Server running on localhost:5173
- Logged in as admin
- Have team members created in the system
- Have leave types configured (Vacation, Sick Leave, etc.)

## Testing Steps

### 1. Access Team Calendar
1. Go to Admin → Vacation Management
2. Click on "Team Calendar" tab
3. You should see an interactive monthly calendar with:
   - Current month displayed
   - Navigation arrows to move between months
   - Legend showing color coding (Blue=Vacation, Red=Sick Leave, Yellow=Other)

### 2. Add Single Day Leave
1. Click on any date in the calendar
2. A modal dialog should pop up with:
   - Team Member dropdown (search field)
   - Leave Type dropdown
   - Start Date and End Date fields
   - Reason text field (optional)
3. Fill in the form:
   - Search and select a team member
   - Select a leave type
   - Dates should be pre-filled with clicked date
4. Click "Add Leave" button
5. You should see:
   - Modal closes
   - Form resets
   - New leave entry appears on calendar (colored badge with employee name)
   - Green notification: "✓ This request will be automatically approved"

### 3. Add Multi-Day Leave
1. Click on a date
2. In the modal, change the End Date to several days later
3. Click "Add Leave"
4. Verify the leave spans multiple days on calendar
5. Each day in the range should show the leave entry

### 4. Test Employee Search
1. Click any date
2. In the Team Member field, type partial name (e.g., "Jo" for "John")
3. Dropdown should filter and show matching employees
4. Click to select an employee
5. Employee name should populate in the field

### 5. Test Leave Type Colors
1. Add a Vacation leave (should be BLUE)
2. Add a Sick Leave (should be RED)
3. Add other leave types and verify colors:
   - Blue = Vacation
   - Red = Sick Leave
   - Yellow = Other types

### 6. Test Calendar Navigation
1. Click right arrow to go to next month
2. Calendar should update to show next month
3. Previous leaves should no longer be visible
4. Click left arrow to return to previous month
5. Previously added leaves should reappear

### 7. Test Today Highlighting
1. Today's date cell should have blue background and border
2. Other dates should have white background
3. Hovering over any date should show hover effect

### 8. Test Error Handling

#### Overlapping Leave Test
1. Add a vacation from Jan 10-15 for an employee
2. Try to add another vacation from Jan 12-18 for same employee
3. Should see error: "Overlapping leave request exists for the same dates and leave type"

#### Missing Required Fields
1. Click a date
2. Leave employee/leave type blank
3. Click "Add Leave"
4. Should see alert: "Please select employee and leave type"

### 9. Test Modal Close
1. Click a date to open modal
2. Click Cancel button
3. Modal should close without saving

### 10. Test Multiple Entries Per Day
1. Add multiple team members' leave on same date
2. Calendar cell should show 2 entries + "+X more" indicator
3. Helps keep UI clean when many people are on leave

## Performance Tests

### Large Calendar Test
1. Add 50+ leave entries for different team members
2. Navigate through months
3. Calendar should respond smoothly without lag

### Search Performance
1. With 100+ team members, search should respond quickly
2. Filtering should be immediate

## Visual Tests

- [ ] Calendar grid is properly aligned
- [ ] Colors are consistent with legend
- [ ] Text is readable on colored badges
- [ ] Modal is centered and styled correctly
- [ ] Buttons have proper hover/active states
- [ ] Form fields have proper spacing
- [ ] Date pickers work smoothly
- [ ] Dropdown menus display correctly

## Browser Tests

- [ ] Chrome/Edge
- [ ] Firefox  
- [ ] Safari
- [ ] Mobile browser (tablet size)

## Database Verification

### Check Approved Status
```sql
SELECT id, employee_id, leave_type_id, status, decision_by, decision_at 
FROM leave_requests 
WHERE status = 'approved' 
ORDER BY created_at DESC 
LIMIT 5;
```
All new leaves from calendar should have `status = 'approved'`

### Check Audit Trail
```sql
SELECT * FROM leave_request_events 
WHERE leave_request_id = [new_request_id] 
ORDER BY created_at;
```
Should show auto-approval event with note "Auto-approved by admin from calendar"

## API Endpoint Tests (using curl/Postman)

### Create and Approve Leave
```bash
curl -X POST http://localhost:5173/api/vacation/admin/create-and-approve \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 1,
    "leaveTypeId": 1,
    "startDate": "2025-01-15",
    "endDate": "2025-01-17",
    "reason": "Annual vacation",
    "autoApprove": true
  }'
```

### Fetch Calendar Events
```bash
curl http://localhost:5173/api/vacation/calendar-events
```

## Known Limitations

1. Half-day leave not yet supported (always full days)
2. Recurring leave not yet supported
3. No email notifications on auto-approval (future enhancement)
4. No conflict warnings for project impact

## Troubleshooting

### Calendar Not Showing Leave
- Check if leave status is "approved" in database
- Verify leave dates are correct
- Refresh the page
- Check browser console for errors

### Modal Not Opening
- Ensure you're logged in as admin
- Check browser console for JavaScript errors
- Verify no other modals are open

### Employee Not Found
- Ensure team members are created in the system
- Try searching with first name or last name
- Check if team member is marked as active

### Date Not Pre-filling
- Ensure date is in correct format (YYYY-MM-DD)
- Try different dates on calendar
- Clear browser cache and retry

## Support

For issues or questions, check:
1. Browser developer console for errors
2. Network tab for API response status
3. Server logs for backend errors
4. IMPLEMENTATION_NOTES.md for technical details
