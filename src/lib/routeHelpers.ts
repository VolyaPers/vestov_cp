/**
 * Type guard for route params from wouter's useRoute hook
 * Ensures params is not null and has the required param property
 */
export function hasRouteParam(
  params: Record<string, string | undefined> | null | undefined,
  paramName: string
): params is Record<string, string> {
  return params !== null && params !== undefined && typeof params[paramName] === 'string' && params[paramName] !== ''
}

/**
 * Extracts route param with type safety
 * Returns the param value or throws if not found
 */
export function getRouteParam(
  params: Record<string, string | undefined> | null | undefined,
  paramName: string
): string {
  if (!hasRouteParam(params, paramName)) {
    throw new Error(`Route param '${paramName}' not found`)
  }
  return params[paramName]
}

