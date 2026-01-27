import type { Config } from 'drizzle-kit'

export default {
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
  },
} satisfies Config