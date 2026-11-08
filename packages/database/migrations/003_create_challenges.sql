-- Up Migration

CREATE TABLE challenges (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT challenges_organization_fkey
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE RESTRICT,

    CONSTRAINT challenges_creator_fkey
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX challenges_organization_id_idx
    ON challenges(organization_id);

CREATE INDEX challenges_created_by_idx
    ON challenges(created_by);

CREATE TABLE challenge_versions (
    id UUID PRIMARY KEY,
    challenge_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'javascript',
    starter_code TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT challenge_versions_challenge_fkey
        FOREIGN KEY (challenge_id)
        REFERENCES challenges(id)
        ON DELETE RESTRICT,

    CONSTRAINT challenge_versions_creator_fkey
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT challenge_versions_number_check
        CHECK (version_number > 0),

    CONSTRAINT challenge_versions_title_check
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

    CONSTRAINT challenge_versions_description_check
        CHECK (char_length(btrim(description)) > 0),

    CONSTRAINT challenge_versions_language_check
        CHECK (language = 'javascript'),

    CONSTRAINT challenge_versions_unique_number
        UNIQUE (challenge_id, version_number)
);

CREATE INDEX challenge_versions_created_by_idx
    ON challenge_versions(created_by);
    