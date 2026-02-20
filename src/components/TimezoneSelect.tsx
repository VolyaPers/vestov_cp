import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COMMON_TIMEZONES } from '@/lib/timezone'

interface TimezoneSelectProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function TimezoneSelect({ value, onChange, placeholder = 'Select timezone...', disabled }: TimezoneSelectProps) {
  if (disabled) {
    return (
      <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm opacity-50 cursor-not-allowed">
        {value ? COMMON_TIMEZONES.find((tz) => tz.value === value)?.label || value : placeholder}
      </div>
    )
  }

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {COMMON_TIMEZONES.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            {tz.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
