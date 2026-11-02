-- Up Migration

-- Allowed organization roles
CREATE TYPE "organization_role" AS ENUM (
    'ADMIN',
    'INTERVIEWER'
);

-- User accounts
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Company workspaces
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Users' roles within organizations
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "organization_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- Unique email addresses
CREATE UNIQUE INDEX "users_email_key"
ON "users" ("email");

-- Unique organization URL identifiers
CREATE UNIQUE INDEX "organizations_slug_key"
ON "organizations" ("slug");

-- Find organizations by their creator
CREATE INDEX "organizations_created_by_idx"
ON "organizations" ("created_by");

-- Find members of an organization
CREATE INDEX "organization_memberships_organization_id_idx"
ON "organization_memberships" ("organization_id");

-- A user can have only one membership per organization
CREATE UNIQUE INDEX "organization_memberships_user_id_organization_id_key"
ON "organization_memberships" ("user_id", "organization_id");

-- Organization creator must be an existing user
ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_created_by_fkey"
FOREIGN KEY ("created_by")
REFERENCES "users" ("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Membership must reference an existing user
ALTER TABLE "organization_memberships"
ADD CONSTRAINT "organization_memberships_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users" ("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Membership must reference an existing organization
ALTER TABLE "organization_memberships"
ADD CONSTRAINT "organization_memberships_organization_id_fkey"
FOREIGN KEY ("organization_id")
REFERENCES "organizations" ("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Email must be lowercase, trimmed, and non-empty
ALTER TABLE "users"
ADD CONSTRAINT "users_email_normalized_check"
CHECK (
    "email" = lower(btrim("email"))
    AND length("email") > 0
);