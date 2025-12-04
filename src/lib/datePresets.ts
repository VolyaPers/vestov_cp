/**
 * Date range preset utilities for invoice filtering
 */

export type DatePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'allTime'

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
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
      }
    }

    case 'lastMonth': {
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      return {
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
      }
    }

    case 'thisYear': {
      const firstDay = new Date(year, 0, 1)
      const lastDay = new Date(year, 11, 31)
      return {
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
      }
    }

    case 'lastYear': {
      const firstDay = new Date(year - 1, 0, 1)
      const lastDay = new Date(year - 1, 11, 31)
      return {
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
      }
    }

    case 'allTime': {
      // Use a very early date and today
      return {
        startDate: '2000-01-01',
        endDate: today.toISOString().split('T')[0],
      }
    }

    default:
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
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

