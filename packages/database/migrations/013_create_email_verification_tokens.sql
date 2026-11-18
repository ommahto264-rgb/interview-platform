-- Up Migration

CREATE TABLE email_verification_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT email_verification_tokens_email_check
        CHECK (
            email = LOWER(BTRIM(email))
            AND CHAR_LENGTH(email) BETWEEN 3 AND 254
        ),

    CONSTRAINT email_verification_tokens_hash_check
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT email_verification_tokens_expiry_check
        CHECK (expires_at > created_at)
);

-- Down Migration

DROP TABLE email_verification_tokens;