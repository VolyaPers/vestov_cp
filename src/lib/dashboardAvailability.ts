export function dashboardSourceState(data: unknown, error: unknown) {
  const usable = data !== undefined && data !== null
  return { usable, fresh: usable && !error }
}

type BalanceSource = { available: number; currency: string } | null

export function dashboardCashPosition(
  data: { stripe: BalanceSource; payoneer: BalanceSource; errors?: string[] } | undefined,
  error?: unknown,
): { amount: number | null; reason: string | null } {
  if (error) return { amount: null, reason: 'Bank balances could not be refreshed' }
  if (!data) return { amount: null, reason: 'Bank balances are loading' }
  if (data.errors?.length) return { amount: null, reason: data.errors.join('; ') }

  const sources = [data.stripe, data.payoneer].filter(
    (source): source is NonNullable<BalanceSource> => source !== null && source !== undefined,
  )
  if (!sources.length) return { amount: null, reason: 'No bank balance provider is connected' }
  if (sources.some(source => typeof source.currency !== 'string' || source.currency.toUpperCase() !== 'USD')) {
    return { amount: null, reason: 'Combined cash requires USD balances; currency conversion is not configured' }
  }
  if (sources.some(source => !Number.isFinite(source.available))) {
    return { amount: null, reason: 'A provider returned an invalid balance' }
  }
  return { amount: sources.reduce((sum, source) => sum + Math.round(source.available * 100), 0) / 100, reason: null }
}
