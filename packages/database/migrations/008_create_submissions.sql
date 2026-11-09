-- Up Migration

CREATE TABLE submissions (
    id UUID PRIMARY KEY,
    interview_id UUID NOT NULL,
    candidate_id UUID NOT NULL,
    source_code TEXT NOT NULL,
    submitted_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT submissions_interview_fkey
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE RESTRICT,

    CONSTRAINT submissions_candidate_fkey
        FOREIGN KEY (candidate_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT submissions_source_code_check
        CHECK (
            char_length(btrim(source_code)) > 0
            AND octet_length(source_code) <= 10240
        )
);

CREATE INDEX submissions_interview_candidate_time_idx
    ON submissions(interview_id, candidate_id, submitted_at DESC);

CREATE INDEX submissions_candidate_idx
    ON submissions(candidate_id);