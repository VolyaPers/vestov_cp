import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

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

function ClearDateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      Clear
    </button>
  )
}

export function AdvancedDatePicker({
  value,
  onChange,
  label,
  placeholder,
  id,
  className = '',
}: AdvancedDatePickerProps) {
  return (
    <div className={className}>
      {(label || value) && (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {label ? <Label htmlFor={id}>{label}</Label> : <span />}
          {value ? <ClearDateButton onClick={() => onChange(undefined)} /> : null}
        </div>
      )}
      <Input
        id={id}
        type="date"
        value={value || ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        placeholder={placeholder}
      />
    </div>
  )
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  className = '',
}: DateRangePickerProps) {
  const hasValue = Boolean(startDate || endDate)

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <Label>Date Range</Label>
        {hasValue ? (
          <ClearDateButton
            onClick={() => {
              onStartDateChange(undefined)
              onEndDateChange(undefined)
            }}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[11rem] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">{startLabel}</Label>
          <Input
            type="date"
            value={startDate || ''}
            onChange={(event) => onStartDateChange(event.target.value || undefined)}
          />
        </div>

        <div className="min-w-[11rem] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">{endLabel}</Label>
          <Input
            type="date"
            value={endDate || ''}
            onChange={(event) => onEndDateChange(event.target.value || undefined)}
          />
        </div>
      </div>
    </div>
  )
}
