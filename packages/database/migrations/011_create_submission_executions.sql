-- Up Migration

-- Optional request keys let clients retry a submission without running it twice.
ALTER TABLE submissions ADD COLUMN request_key UUID;
CREATE UNIQUE INDEX submissions_candidate_request_key_idx
    ON submissions(candidate_id, request_key) WHERE request_key IS NOT NULL;

-- This row is both the durable job and its result. Snapshots keep retries consistent.
CREATE TABLE submission_executions (
    id UUID PRIMARY KEY,
    submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE RESTRICT,
    challenge_version_id UUID NOT NULL REFERENCES challenge_versions(id) ON DELETE RESTRICT,
    source_code TEXT NOT NULL CHECK (octet_length(source_code) BETWEEN 1 AND 10240),
    test_cases JSONB NOT NULL CHECK (
        jsonb_typeof(test_cases) = 'array'
        AND jsonb_array_length(test_cases) BETWEEN 1 AND 100
        AND octet_length(test_cases::text) <= 262144
    ),
    status TEXT NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_token UUID,
    lease_expires_at TIMESTAMPTZ,
    verdict TEXT CHECK (verdict IN (
        'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED',
        'OUTPUT_LIMIT_EXCEEDED', 'RUNTIME_ERROR'
    )),
    passed_tests INTEGER,
    total_tests INTEGER NOT NULL CHECK (total_tests BETWEEN 1 AND 100),
    results JSONB,
    error_code TEXT CHECK (error_code IN ('RUNNER_UNAVAILABLE', 'WORKER_INTERRUPTED')),
    runner_image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    CHECK ((status = 'RUNNING') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
    CHECK (status = 'RUNNING' OR (lease_token IS NULL AND lease_expires_at IS NULL)),
    CHECK (passed_tests IS NULL OR passed_tests BETWEEN 0 AND total_tests),
    CHECK ((status = 'COMPLETED') = (verdict IS NOT NULL AND results IS NOT NULL AND passed_tests IS NOT NULL)),
    CHECK ((status IN ('COMPLETED', 'FAILED')) = (finished_at IS NOT NULL))
);
CREATE INDEX submission_executions_ready_idx
    ON submission_executions(available_at, created_at) WHERE status = 'QUEUED';
CREATE INDEX submission_executions_lease_idx
    ON submission_executions(lease_expires_at) WHERE status = 'RUNNING';

-- Down Migration
DROP TABLE submission_executions;
DROP INDEX submissions_candidate_request_key_idx;
ALTER TABLE submissions DROP COLUMN request_key;
