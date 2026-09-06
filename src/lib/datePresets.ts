/**
 * Date range preset utilities for invoice filtering
 */

export type DatePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'allTime'

const localDateKey = (date:Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export interface DateRange {
  startDate: string
  endDate: string
}

/**
 * Get date range for a preset
 */
export function getDatePreset(preset: DatePreset): DateRange {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  switch (preset) {
    case 'thisMonth': {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      return {
        startDate: localDateKey(firstDay),
        endDate: localDateKey(lastDay),
      }
    }

    case 'lastMonth': {
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      return {
        startDate: localDateKey(firstDay),
        endDate: localDateKey(lastDay),
      }
    }

    case 'thisYear': {
      const firstDay = new Date(year, 0, 1)
      const lastDay = new Date(year, 11, 31)
      return {
        startDate: localDateKey(firstDay),
        endDate: localDateKey(lastDay),
      }
    }

    case 'lastYear': {
      const firstDay = new Date(year - 1, 0, 1)
      const lastDay = new Date(year - 1, 11, 31)
      return {
        startDate: localDateKey(firstDay),
        endDate: localDateKey(lastDay),
      }
    }

    case 'allTime': {
      // Use a very early date and today
      return {
        startDate: '2000-01-01',
        endDate: localDateKey(today),
      }
    }

    default:
      return {
        startDate: localDateKey(today),
        endDate: localDateKey(today),
      }
  }
}

/**
 * Get label for a preset
 */
export function getPresetLabel(preset: DatePreset): string {
  switch (preset) {
    case 'thisMonth':
      return 'This Month'
    case 'lastMonth':
      return 'Last Month'
    case 'thisYear':
      return 'This Year'
    case 'lastYear':
      return 'Last Year'
    case 'allTime':
      return 'All Time'
    default:
      return ''
  }
}

