-- Rename AdKit project column → AdLoop encrypted API key (Strategy A)
-- Run once on existing databases: psql $DATABASE_URL -f scripts/migrate-adloop-column.sql

ALTER TABLE organization_metadata
  RENAME COLUMN adkit_project_id TO adloop_api_key_encrypted;

-- Remove fake AdKit-linked connections (no real OAuth tokens)
DELETE FROM connections WHERE encrypted_tokens = 'adkit:linked';
