-- Up Migration

CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY,

    organization_id UUID NOT NULL,
    email TEXT NOT NULL,
    role organization_role NOT NULL DEFAULT 'INTERVIEWER',

    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL,

    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ(3) NOT NULL,
    accepted_at TIMESTAMPTZ(3),
    revoked_at TIMESTAMPTZ(3),

    CONSTRAINT organization_invitations_organization_fkey
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT organization_invitations_inviter_fkey
        FOREIGN KEY (invited_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT organization_invitations_email_check
        CHECK (
            email = LOWER(BTRIM(email))
            AND LENGTH(email) BETWEEN 3 AND 254
        ),

    CONSTRAINT organization_invitations_role_check
        CHECK (role = 'INTERVIEWER'),

    CONSTRAINT organization_invitations_expiry_check
        CHECK (expires_at > created_at),

    CONSTRAINT organization_invitations_state_check
        CHECK (
            accepted_at IS NULL
            OR revoked_at IS NULL
        ),

    CONSTRAINT organization_invitations_acceptance_time_check
        CHECK (
            accepted_at IS NULL
            OR (
                accepted_at >= created_at
                AND accepted_at < expires_at
            )
        ),

    CONSTRAINT organization_invitations_revocation_time_check
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= created_at
        )
);

CREATE INDEX organization_invitations_organization_created_idx
    ON organization_invitations (organization_id, created_at DESC);

CREATE INDEX organization_invitations_invited_by_idx
    ON organization_invitations (invited_by);

CREATE UNIQUE INDEX organization_invitations_pending_email_key
    ON organization_invitations (organization_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Down Migration

DROP TABLE organization_invitations;