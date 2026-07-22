-- Add Meta Page ID per org (adkit briefs)
ALTER TABLE organization_metadata
  ADD COLUMN IF NOT EXISTS meta_page_id text;
