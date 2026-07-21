# Orkestria MCP

Control your ad campaigns from any MCP-compatible agent (Cursor, Claude Desktop, Claude Code…): Google Ads, Meta, LinkedIn, TikTok, Snapchat, Reddit, Microsoft, X, Amazon Ads and Pinterest.

Every write goes through the Orkestria policy engine: **dry-run by default**, optional human approval, spend caps, protected campaigns and a full audit trail.

## Setup

1. Create an account on [orkestria.one](https://orkestria.one) and connect your ad platforms (OAuth).
2. Generate an API key (`ork_...`) from **Dashboard → Clés API**, choosing scopes (`read`, `write`, `admin`).

### Cursor / Claude Desktop / Claude Code (local, stdio)

```json
{
  "mcpServers": {
    "orkestria": {
      "command": "npx",
      "args": ["-y", "orkestria-mcp"],
      "env": {
        "ORKESTRIA_API_KEY": "ork_..."
      }
    }
  }
}
```

### Hosted (streamable HTTP)

No install — point your client at the hosted endpoint:

```json
{
  "mcpServers": {
    "orkestria": {
      "url": "https://orkestria.one/api/mcp",
      "headers": {
        "Authorization": "Bearer ork_..."
      }
    }
  }
}
```

## First steps

Ask your agent:

1. `validate_setup` — checks the key, lists connected platforms and the active policy.
2. `list_campaigns` — reads campaigns across all connected platforms.
3. `update_budget` with `mode: "dry_run"` — see the diff without touching anything.
4. Approve from the dashboard (or `approve_action`) and it runs live.

## Tools

| Family | Tools |
| --- | --- |
| Core | `whoami`, `validate_setup`, `list_connections`, `list_ad_accounts` |
| Launch | `create_campaign`, `set_budget`, `create_media_plan` |
| Optimize | `update_budget`, `pause_campaign`, `enable_campaign`, `reallocate_budget` |
| Create | `generate_ad_copy`, `list_creatives` |
| Measure | `get_performance`, `list_campaigns`, `get_account_summary`, `compare_campaigns`, `get_spend`, `detect_anomalies` |
| Govern | `list_pending_approvals`, `approve_action`, `reject_action`, `get_audit_log`, `get_policies`, `set_policy` |

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `ORKESTRIA_API_KEY` | — (required) | API key from the dashboard |
| `ORKESTRIA_API_URL` | `https://orkestria.one` | Self-hosted instance URL |

## Safety model

- `read` scope: read-only tools only.
- `write` scope: can execute `mode: "live"` and approve/reject actions.
- `admin` scope: can edit workspace policies.
- Default mode is `dry_run` — nothing is changed on the platforms until you opt in.
- Every call (read and write) is logged in the workspace audit trail.
