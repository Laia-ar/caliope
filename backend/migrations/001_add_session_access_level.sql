-- Migration: add access_level to classroom_sessions and user_id to session_participants
-- Run this against the existing SQLite database before deploying the new code.

ALTER TABLE classroom_sessions ADD COLUMN access_level VARCHAR(20) NOT NULL DEFAULT 'registered';
ALTER TABLE session_participants ADD COLUMN user_id INTEGER REFERENCES users(id);
