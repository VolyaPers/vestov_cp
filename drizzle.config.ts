import type { Config } from 'drizzle-kit'

export default {
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
  },
} satisfies Config