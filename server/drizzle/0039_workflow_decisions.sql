CREATE TABLE IF NOT EXISTS workflow_assignments (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL CHECK (role IN ('owner', 'deputy')),
  display_name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
-- Existing identities verified in the production Users screen on 2026-09-06.
-- Bind once by exact email; later email/name edits cannot transfer authority.
INSERT INTO workflow_assignments (user_id, role, display_name)
SELECT id, 'owner', 'Volodymyr Shapovalov' FROM users
WHERE lower(email) = 'v@vestov.com' AND role = 'admin' AND is_active = true
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO workflow_assignments (user_id, role, display_name)
SELECT id, 'deputy', 'Patricia' FROM users
WHERE lower(email) = 'p.rangel@vestov.com' AND role = 'admin' AND is_active = true
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS first_response_due_at timestamp;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS first_responded_at timestamp;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolved_at timestamp;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
UPDATE feedback SET first_responded_at = admin_responded_at WHERE first_responded_at IS NULL AND admin_responded_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS feedback_messages (
  id serial PRIMARY KEY,
  feedback_id integer NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  author_id integer NOT NULL REFERENCES users(id),
  body text NOT NULL,
  kind varchar(30) NOT NULL DEFAULT 'reply',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_messages_thread_idx ON feedback_messages(feedback_id, created_at);
CREATE INDEX IF NOT EXISTS feedback_open_response_idx ON feedback(created_at) WHERE first_responded_at IS NULL;
CREATE TABLE IF NOT EXISTS workflow_notifications (
  id serial PRIMARY KEY,
  event_key varchar(200) NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  read_at timestamp,
  slack_sent_at timestamp,
  superseded_at timestamp,
  slack_attempts integer NOT NULL DEFAULT 0,
  slack_next_attempt_at timestamp NOT NULL DEFAULT now(),
  slack_last_error text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_notifications_event_user_unique ON workflow_notifications(event_key, user_id);
CREATE INDEX IF NOT EXISTS workflow_notifications_inbox_idx ON workflow_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_notifications_outbox_idx ON workflow_notifications(slack_next_attempt_at) WHERE slack_sent_at IS NULL AND superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS leave_requests_decision_idx ON leave_requests(created_at) WHERE status = 'pending' AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS reimbursement_requests_decision_idx ON reimbursement_requests(requested_at) WHERE status = 'pending';

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS decision_requested_at timestamp;
