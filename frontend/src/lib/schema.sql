-- Database schema for the demo frontend (PostgreSQL).
-- Run via: npm run db:migrate

-- Needed for gen_random_uuid(). Built into Postgres 13+, but this makes it
-- explicit and also works on older installs.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users / accounts ──────────────────────────────────────────────────────
-- One row per signed-up account. We only collect restaurant name, email and
-- password; the password is stored as a bcrypt hash, never in plain text.
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),     -- user id
  restaurant_id   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(), -- their restaurant id
  recipe_id       UUID,                                           -- reserved, filled in later
  restaurant_name TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Recipe Agent provisioning ─────────────────────────────────────────────
-- The Recipe Creation Agent lives on a separate deployed backend that gates
-- access behind a per-restaurant API key. The first time a user opens the
-- agent they "register": we call the backend's POST /admin/restaurant, get an
-- api_key + restaurant_id back, and store them here. A non-null agent_api_key
-- means "this restaurant has provisioned the agent before" — so we skip the
-- registration modal on later visits. Added as idempotent ALTERs so existing
-- databases pick them up on the next `npm run db:migrate`.
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_restaurant_id  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_api_key        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_venue_type     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_specialty_tags JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_registered_at  TIMESTAMPTZ;

-- V4 P-V Day 11. Two of these are now dead and both are **left alone**, which is
-- a different decision from the manager column below.
--
--   * `agent_venue_type` — V4 moved the venue kind into the *request* (P-I Day
--     8), so the backend drops the field and the modal no longer asks for it.
--     The request screen's *Kind of place* dropdown remembers the chef's last
--     answer in the browser instead: it can read the venue registry and this
--     column's writer could not, which is the whole of the argument (see
--     `RegisterModal.js`).
--   * `agent_specialty_tags` — nothing has read it since the ranking API went.
--
-- Neither is dropped, because existing rows carry real answers a chef gave and
-- dropping a column to tidy a form is how you lose the only copy of something.
-- The manager column below is dropped precisely because it is the opposite case:
-- nothing ever wrote it, and what it *reads* as is a security control.

-- ── Manager PIN — REMOVED, V4 P-V Day 11 ──────────────────────────────────
-- The PIN existed to delegate the *manager view* — the analytics panels and the
-- catalogue review — to staff without sharing the account login. Every one of
-- those panels belonged to the V1/V2 ranking API and was deleted with it, so the
-- gate has had nothing behind it since the V2 removal: the proxy's tier check
-- listed no manager-tier path, which means the unlock could never have opened
-- anything and the column could never have been set.
--
-- Dropped rather than left in place, and that is the argument for dropping it: a
-- nullable column named `manager_pin_hash` on a live users table reads as a
-- security control to the next person who finds it, and a security control that
-- protects nothing is worse than none. There is no data to lose — no UI ever
-- wrote it.
ALTER TABLE users DROP COLUMN IF EXISTS manager_pin_hash;

-- ── Sessions ──────────────────────────────────────────────────────────────
-- Server-side sessions. The browser only holds an opaque random token in an
-- httpOnly cookie; we look that token up here to identify the user.
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- The session half of the manager gate, dropped with it on V4 P-V Day 11. See
-- the note on `manager_pin_hash` above.
ALTER TABLE sessions DROP COLUMN IF EXISTS manager_unlocked_until;

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

