-- Up Migration

-- These keys let interviews enforce matching relationships.
ALTER TABLE challenges
ADD CONSTRAINT challenges_id_organization_unique
UNIQUE (id, organization_id);

ALTER TABLE challenge_versions
ADD CONSTRAINT challenge_versions_id_challenge_unique
UNIQUE (id, challenge_id);

CREATE TABLE interviews (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    challenge_version_id UUID NOT NULL,

    title TEXT NOT NULL,
    interviewer_id UUID NOT NULL,
    created_by UUID NOT NULL,

    scheduled_start_at TIMESTAMPTZ(3) NOT NULL,
    scheduled_end_at TIMESTAMPTZ(3) NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',

    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT interviews_challenge_organization_fkey
        FOREIGN KEY (challenge_id, organization_id)
        REFERENCES challenges(id, organization_id)
        ON DELETE RESTRICT,

    CONSTRAINT interviews_challenge_version_fkey
        FOREIGN KEY (challenge_version_id, challenge_id)
        REFERENCES challenge_versions(id, challenge_id)
        ON DELETE RESTRICT,

    CONSTRAINT interviews_interviewer_fkey
        FOREIGN KEY (interviewer_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT interviews_creator_fkey
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT interviews_title_check
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

    CONSTRAINT interviews_schedule_check
        CHECK (scheduled_end_at > scheduled_start_at),

    CONSTRAINT interviews_status_check
        CHECK (status IN (
            'SCHEDULED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        ))
);

CREATE INDEX interviews_organization_schedule_idx
    ON interviews(organization_id, scheduled_start_at);

CREATE INDEX interviews_interviewer_schedule_idx
    ON interviews(interviewer_id, scheduled_start_at);

CREATE INDEX interviews_challenge_version_idx
    ON interviews(challenge_version_id, challenge_id);

CREATE INDEX interviews_challenge_organization_idx
    ON interviews(challenge_id, organization_id);

CREATE INDEX interviews_created_by_idx
    ON interviews(created_by);