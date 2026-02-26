-- Distributed rate limiting (Supabase-backed)
-- key: "ip:<ip>:<hour>" or "global:<hour>"
-- Run: supabase db push

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

CREATE OR REPLACE FUNCTION increment_rate_limit(p_key TEXT, p_window_start TIMESTAMPTZ)
RETURNS void AS $$
  INSERT INTO rate_limits (key, window_start, count, updated_at)
  VALUES (p_key, p_window_start, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = rate_limits.count + 1,
    updated_at = now();
$$ LANGUAGE sql;
