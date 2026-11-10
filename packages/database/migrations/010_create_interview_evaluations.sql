-- Up Migration

CREATE TABLE interview_evaluations (
    id UUID PRIMARY KEY,
    interview_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,

    problem_solving_score SMALLINT NOT NULL,
    code_quality_score SMALLINT NOT NULL,
    communication_score SMALLINT NOT NULL,

    recommendation TEXT NOT NULL,
    feedback TEXT NOT NULL,

    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT interview_evaluations_interview_fkey
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE RESTRICT,

    CONSTRAINT interview_evaluations_reviewer_fkey
        FOREIGN KEY (reviewer_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT interview_evaluations_problem_solving_check
        CHECK (problem_solving_score BETWEEN 1 AND 5),

    CONSTRAINT interview_evaluations_code_quality_check
        CHECK (code_quality_score BETWEEN 1 AND 5),

    CONSTRAINT interview_evaluations_communication_check
        CHECK (communication_score BETWEEN 1 AND 5),

    CONSTRAINT interview_evaluations_recommendation_check
        CHECK (recommendation IN (
            'STRONG_NO',
            'NO',
            'YES',
            'STRONG_YES'
        )),

    CONSTRAINT interview_evaluations_feedback_check
        CHECK (char_length(btrim(feedback)) BETWEEN 1 AND 5000),

    CONSTRAINT interview_evaluations_reviewer_unique
        UNIQUE (interview_id, reviewer_id)
);

CREATE INDEX interview_evaluations_reviewer_idx
    ON interview_evaluations(reviewer_id);