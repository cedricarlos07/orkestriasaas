#!/bin/bash
set -euo pipefail
RELEASE=/opt/openship/releases/dep_Bl3oJdH3Ri7AmtCv
COMMIT="$1"

docker exec -i openship-postgres-1 psql -U openship -d orkestria <<'SQL'
CREATE TABLE IF NOT EXISTS usage_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  kind text NOT NULL,
  cost_usd numeric(12,6) DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_events_org_created_idx ON usage_events (organization_id, created_at);
CREATE INDEX IF NOT EXISTS usage_events_org_kind_idx ON usage_events (organization_id, kind);

UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 40, 'aiBudgetUsdMonthly', 2, 'brands', 1, 'adAccounts', 1, 'users', 1,
  'apiPerMinute', 30, 'apiPerHour', 500, 'apiPerDay', 2000, 'mcpCallsPerMonth', 2000, 'llmCallsPerDay', 80, 'writesPerHour', 20
) WHERE id='solo';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 250, 'aiBudgetUsdMonthly', 8, 'brands', 3, 'adAccounts', 3, 'users', 3,
  'apiPerMinute', 60, 'apiPerHour', 2000, 'apiPerDay', 8000, 'mcpCallsPerMonth', 10000, 'llmCallsPerDay', 300, 'writesPerHour', 60
) WHERE id='business';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 800, 'aiBudgetUsdMonthly', 20, 'brands', 5, 'adAccounts', 8, 'users', 8,
  'apiPerMinute', 120, 'apiPerHour', 5000, 'apiPerDay', 20000, 'mcpCallsPerMonth', 40000, 'llmCallsPerDay', 800, 'writesPerHour', 120
) WHERE id='growth';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 2000, 'aiBudgetUsdMonthly', 40, 'brands', 10, 'adAccounts', 15, 'users', 15,
  'apiPerMinute', 180, 'apiPerHour', 10000, 'apiPerDay', 40000, 'mcpCallsPerMonth', 80000, 'llmCallsPerDay', 1500, 'writesPerHour', 200
) WHERE id='autopilot';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 500, 'aiBudgetUsdMonthly', 25, 'brands', 5, 'adAccounts', 15, 'users', 5,
  'apiPerMinute', 90, 'apiPerHour', 3000, 'apiPerDay', 12000, 'mcpCallsPerMonth', 20000, 'llmCallsPerDay', 500, 'writesPerHour', 80
) WHERE id='agency_start';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 3000, 'aiBudgetUsdMonthly', 80, 'brands', 15, 'adAccounts', 45, 'users', 15,
  'apiPerMinute', 200, 'apiPerHour', 15000, 'apiPerDay', 60000, 'mcpCallsPerMonth', 120000, 'llmCallsPerDay', 2000, 'writesPerHour', 300
) WHERE id='agency_growth';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', 10000, 'aiBudgetUsdMonthly', 200, 'brands', 40, 'adAccounts', 999, 'users', 40,
  'apiPerMinute', 400, 'apiPerHour', 40000, 'apiPerDay', 150000, 'mcpCallsPerMonth', 400000, 'llmCallsPerDay', 5000, 'writesPerHour', 600
) WHERE id='agency_scale';
UPDATE plans SET quotas = jsonb_build_object(
  'runsPerMonth', -1, 'aiBudgetUsdMonthly', 500, 'brands', -1, 'adAccounts', -1, 'users', -1,
  'apiPerMinute', 600, 'apiPerHour', 100000, 'apiPerDay', 400000, 'mcpCallsPerMonth', -1, 'llmCallsPerDay', 15000, 'writesPerHour', 1200
) WHERE id='enterprise';

INSERT INTO ai_limits (id, daily_global_usd, per_org_usd, updated_at)
VALUES ('default', 300, 8, NOW())
ON CONFLICT (id) DO UPDATE SET daily_global_usd=300, per_org_usd=8, updated_at=NOW();

SELECT id, quotas->>'apiPerMinute' AS rpm, quotas->>'mcpCallsPerMonth' AS mcp_mo FROM plans ORDER BY price_monthly;
SQL

cd "$RELEASE"
git fetch origin orkestria-mcp
git checkout "$COMMIT"
npm install --include=dev
npm run build
systemctl restart openship-dep_Bl3oJdH3Ri7AmtCv.service
sleep 8
systemctl is-active openship-dep_Bl3oJdH3Ri7AmtCv.service
curl -sS -o /dev/null -w "home=%{http_code}\n" http://127.0.0.1:3016/
git log -1 --oneline
echo DONE
