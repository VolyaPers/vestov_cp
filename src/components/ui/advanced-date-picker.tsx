import React from 'react'
import { DatePicker, DateRangePicker as RSuiteDateRangePicker } from 'rsuite'
import { Label } from '@/components/ui/label'
import 'rsuite/dist/rsuite.min.css'

interface AdvancedDatePickerProps {
  value?: string
  onChange: (date: string | undefined) => void
  label?: string
  placeholder?: string
  id?: string
  className?: string
}

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onStartDateChange: (date: string | undefined) => void
  onEndDateChange: (date: string | undefined) => void
  startLabel?: string
  endLabel?: string
  className?: string
}

export function AdvancedDatePicker({ 
  value, 
  onChange, 
  label, 
  placeholder = "Select date",
  id,
  className = ""
}: AdvancedDatePickerProps) {
  const handleDateChange = (date: Date | null) => {
    if (date) {
      // Use local date to avoid timezone issues
      const dateStr = date.getFullYear() + '-' + 
                     String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(date.getDate()).padStart(2, '0')
      onChange(dateStr)
    } else {
      onChange(undefined)
    }
  }

  const dateValue = value ? new Date(value) : null

  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <DatePicker
        id={id}
        value={dateValue}
        onChange={handleDateChange}
        placeholder={placeholder}
        format="MMM dd, yyyy"
        size="lg"
        block
        cleanable
        style={{ marginTop: label ? '6px' : '0' }}
        menuStyle={{ zIndex: 9999 }}
      />
    </div>
  )
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = "Start Date",
  endLabel = "End Date", 
  className = ""
}: DateRangePickerProps) {
  const handleRangeChange = (range: any) => {
    if (Array.isArray(range) && range.length === 2) {
      const [start, end] = range
      
      if (start && end) {
        // Both dates selected - use local date to avoid timezone issues
        const startStr = start.getFullYear() + '-' + 
                         String(start.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(start.getDate()).padStart(2, '0')
        const endStr = end.getFullYear() + '-' + 
                      String(end.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(end.getDate()).padStart(2, '0')
        onStartDateChange(startStr)
        onEndDateChange(endStr)
      } else if (start && !end) {
        // Only start date selected
        const startStr = start.getFullYear() + '-' + 
                         String(start.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(start.getDate()).padStart(2, '0')
        onStartDateChange(startStr)
        onEndDateChange('')
      }
    } else if (!range || range === null) {
      // Range was cleared
      onStartDateChange('')
      onEndDateChange('')
    }
  }

  const rangeValue: [Date, Date] | null = 
    startDate && startDate !== '' && endDate && endDate !== ''
      ? [new Date(startDate), new Date(endDate)]
      : null

  return (
    <div className={className}>
      <Label>Date Range</Label>
      <RSuiteDateRangePicker
        value={rangeValue}
        onChange={handleRangeChange}
        placeholder="Select date range"
        format="MMM dd, yyyy"
        size="lg"
        block
        cleanable
        style={{ marginTop: '6px' }}
        menuStyle={{ zIndex: 9999 }}
      />
    </div>
  )
}