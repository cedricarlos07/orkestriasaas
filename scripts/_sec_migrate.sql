-- Additive-only security migration. Safe to re-run.
-- 1) Durable fixed-window rate limit counters (app-level limiter).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       text        NOT NULL,
  window_start integer     NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  expires_at   timestamp   NOT NULL,
  CONSTRAINT rate_limits_bucket_window_start_pk PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits (expires_at);

-- 2) better-auth's own rate limit store (rateLimit.storage = "database").
CREATE TABLE IF NOT EXISTS rate_limit (
  id           text   PRIMARY KEY,
  key          text   NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  last_request bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rate_limit_key_idx ON rate_limit (key);

-- 3) Bounded API key lifetime. NULL = legacy key that never expires.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at timestamp;
