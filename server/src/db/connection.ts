import type { PoolConfig } from 'pg'

/** Drizzle timestamp-without-time-zone columns encode/decode UTC wall time.
 * Set this before the first SQL statement, including defaults and migrations.
 * A URI options parameter overrides Pool.options in node-postgres, so normalize
 * the URI itself and append UTC after inherited options (last setting wins).
 */
export function applicationPoolConfig(connectionString: string, inheritedOptions = process.env.PGOPTIONS): PoolConfig {
  const uri = new URL(connectionString)
  const existing = uri.searchParams.get('options') || inheritedOptions || ''
  uri.searchParams.set('options', `${existing} -c TimeZone=UTC`.trim())
  return { connectionString: uri.toString() }
}
