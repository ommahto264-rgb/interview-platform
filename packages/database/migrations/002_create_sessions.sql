-- Up Migration

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT sessions_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx
    ON sessions(user_id);

CREATE INDEX sessions_expires_at_idx
    ON sessions(expires_at);