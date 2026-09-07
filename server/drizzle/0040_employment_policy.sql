ALTER TABLE team_members ADD CONSTRAINT team_members_employment_type_check CHECK (employment_type IN ('fulltime', 'part_time', 'freelancer'));
--> statement-breakpoint
ALTER TABLE salary_rate_history ADD COLUMN employment_type varchar(20) NOT NULL DEFAULT 'fulltime';
UPDATE salary_rate_history h SET employment_type = t.employment_type FROM team_members t WHERE h.team_member_id = t.id;
ALTER TABLE payroll_periods ADD COLUMN employment_type varchar(20) NOT NULL DEFAULT 'fulltime';
-- Existing payroll snapshots retain their amounts and the policy under which they were accrued.
--> statement-breakpoint
CREATE TABLE freelancer_fees (
  id serial PRIMARY KEY,
  team_member_id integer NOT NULL REFERENCES team_members(id),
  client_service_id integer NOT NULL REFERENCES client_services(id),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  accrued_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'paid', 'cancelled')),
  payment_transaction_id integer UNIQUE REFERENCES financial_transactions(id),
  idempotency_key varchar(100) NOT NULL UNIQUE,
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT freelancer_fee_payment_state CHECK ((status = 'paid') = (payment_transaction_id IS NOT NULL))
);
CREATE INDEX freelancer_fees_member_idx ON freelancer_fees(team_member_id);
