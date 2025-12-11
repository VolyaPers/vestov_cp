# Team Calendar - Quick Start Guide

## 🚀 How to Use (30 seconds)

### Step 1: Navigate to Calendar
```
Admin Dashboard → Vacation & Leave Management → Team Calendar Tab
```

### Step 2: Click a Date
- Click any date on the calendar
- A popup form appears

### Step 3: Fill the Form
1. **Search & Select Team Member** - Type name, click to select
2. **Choose Leave Type** - Vacation, Sick Leave, etc.
3. **Set Dates** - Start and end date (can be same day)
4. **Add Reason** - Optional note about the leave
5. **Click "Add Leave"** - That's it!

### Step 4: Confirm
✓ Leave appears on calendar instantly
✓ Automatically approved
✓ No further action needed

---

## 📅 Calendar Features

| Feature | How to Use |
|---------|-----------|
| **Navigate Months** | Click ← → arrows to move between months |
| **Today's Date** | Highlighted with blue background |
| **Color Legend** | 🔵 Vacation, 🔴 Sick Leave, 🟡 Other |
| **Multiple Entries** | If 2+ entries on same day, shows "+X more" |
| **Employee Names** | Displays on colored badges |

---

## ⚡ Quick Tips

✅ Click date → form prefills with that date
✅ Type employee name to search
✅ Set same start/end for single-day leave
✅ Set different dates for multi-day leave
✅ Green banner confirms auto-approval
✅ No refresh needed - updates live
✅ Cancel button to close form
✅ Modal prevents accidental clicks outside

---

## 🎨 Color Guide

```
🔵 Blue   = Vacation Days
🔴 Red    = Sick Leave  
🟡 Yellow = Other Leave Types
```

---

## ❌ Error Messages & Solutions

| Error | Solution |
|-------|----------|
| "Please select employee and leave type" | Fill both required fields before submitting |
| "Overlapping leave request exists" | Employee already has leave those dates for that type |
| "Start date must be before or equal to end date" | End date should be same or after start date |

---

## 🔐 Admin Only

This feature is **admin-only**. Non-admin users cannot:
- Click dates to add leave
- See the "Add Leave" form
- Create leave through calendar

---

## 📊 What Gets Recorded

When you add leave via calendar:

✓ Employee ID
✓ Leave Type
✓ Start & End Dates
✓ Reason (if provided)
✓ Status: **APPROVED** (automatically)
✓ Approved by: Your admin account
✓ Approval time: Current timestamp
✓ Audit trail: Full history in database

---

## 🔄 Real-Time Updates

- Form updates calendar live
- No page refresh needed
- React Query handles caching
- Search results update as you type
- Modal updates instantly

---

## 📱 Works On

✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
✅ Tablets (iPad, Android tablets)
✅ Touch-friendly date pickers
✅ Responsive modal design

---

## 💬 Common Questions

**Q: Do I need to approve the request after adding it?**
A: No! It's automatically approved. Calendar shows it instantly.

**Q: Can employees see this?**
A: Yes, they see approved leave on the calendar (Team Calendar view).

**Q: Can employees add leave through this?**
A: No, admin-only feature. They use standard leave request forms.

**Q: What if I make a mistake?**
A: Just add another leave to override, or contact your manager to delete.

**Q: Does it send email notifications?**
A: Not yet - planned for future update.

**Q: Can I set recurring leave?**
A: Not yet - planned for future update.

---

## 🎯 Perfect For

- Planning team coverage
- Scheduling absences quickly
- No approval delays
- Instant visibility
- Team coordination

---

## ⚙️ Behind the Scenes

When you add leave:

1. Form validates your input
2. Sends to backend API
3. Backend checks for conflicts
4. Creates approved leave request
5. Records audit trail
6. Frontend refreshes calendar
7. New leave shows with color badge

---

## 📞 Need Help?

Check these files:
- `TESTING_CALENDAR.md` - Detailed testing guide
- `IMPLEMENTATION_NOTES.md` - Technical details
- `FEATURE_SUMMARY.md` - Full feature overview

---

**That's it! Enjoy the new Team Calendar!** 🎉
