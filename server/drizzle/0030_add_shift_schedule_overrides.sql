CREATE TABLE IF NOT EXISTS shift_schedule_overrides (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES team_members(id),
  override_date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  is_day_off BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(employee_id, override_date)
);
