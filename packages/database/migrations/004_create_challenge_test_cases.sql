-- Up Migration

CREATE TABLE challenge_test_cases (
    id UUID PRIMARY KEY,
    challenge_version_id UUID NOT NULL,
    position INTEGER NOT NULL,
    input JSONB NOT NULL,
    expected_output JSONB NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT challenge_test_cases_version_fkey
        FOREIGN KEY (challenge_version_id)
        REFERENCES challenge_versions(id)
        ON DELETE RESTRICT,

    CONSTRAINT challenge_test_cases_position_check
        CHECK (position > 0),

    CONSTRAINT challenge_test_cases_input_check
        CHECK (jsonb_typeof(input) = 'array'),

    CONSTRAINT challenge_test_cases_unique_position
        UNIQUE (challenge_version_id, position)
);