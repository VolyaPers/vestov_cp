ALTER TABLE invoices ADD COLUMN stripe_invoice_id text UNIQUE,
  ADD COLUMN stripe_paid_amount numeric(12,2),
  ADD COLUMN stripe_remaining numeric(12,2);
