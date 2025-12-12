export interface DrizzleMigration {
  name: string
  hash: string
  created_at: Date
}

export interface MigrationResult {
  appliedCount: number
  migrations: DrizzleMigration[]
}

