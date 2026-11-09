-- Up Migration

ALTER TABLE interviews
ADD COLUMN started_at TIMESTAMPTZ(3);