-- Up Migration

ALTER TABLE interviews
ADD COLUMN completed_at TIMESTAMPTZ(3);

ALTER TABLE interviews
ADD CONSTRAINT interviews_completion_time_check
CHECK (
    completed_at IS NULL
    OR (
        started_at IS NOT NULL
        AND completed_at >= started_at
    )
);