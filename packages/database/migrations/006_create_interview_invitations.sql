-- Up Migration

CREATE TABLE interview_invitations (
    id UUID PRIMARY KEY,
    interview_id UUID NOT NULL,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL,

    expires_at TIMESTAMPTZ(3) NOT NULL,
    accepted_at TIMESTAMPTZ(3),
    revoked_at TIMESTAMPTZ(3),
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT interview_invitations_interview_fkey
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE RESTRICT,

    CONSTRAINT interview_invitations_inviter_fkey
        FOREIGN KEY (invited_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT interview_invitations_email_check
        CHECK (
            email = lower(btrim(email))
            AND char_length(email) BETWEEN 1 AND 254
        ),

    CONSTRAINT interview_invitations_expiry_check
        CHECK (expires_at > created_at),

    CONSTRAINT interview_invitations_state_check
        CHECK (
            accepted_at IS NULL
            OR revoked_at IS NULL
        )
);

CREATE INDEX interview_invitations_interview_idx
    ON interview_invitations(interview_id);

CREATE INDEX interview_invitations_invited_by_idx
    ON interview_invitations(invited_by);

CREATE INDEX interview_invitations_expiry_idx
    ON interview_invitations(expires_at);

CREATE TABLE interview_candidates (
    interview_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    invitation_id UUID NOT NULL UNIQUE,
    joined_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT interview_candidates_interview_fkey
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE RESTRICT,

    CONSTRAINT interview_candidates_user_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT interview_candidates_invitation_fkey
        FOREIGN KEY (invitation_id)
        REFERENCES interview_invitations(id)
        ON DELETE RESTRICT
);

CREATE INDEX interview_candidates_user_idx
    ON interview_candidates(user_id);