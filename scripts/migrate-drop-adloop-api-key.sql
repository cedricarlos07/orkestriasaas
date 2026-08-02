-- Drop unused AdLoop legacy column (org metadata).
ALTER TABLE organization_metadata DROP COLUMN IF EXISTS adloop_api_key_encrypted;
