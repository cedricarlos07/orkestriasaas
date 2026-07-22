# Orkestria MCP

Control your ad campaigns from any MCP-compatible agent (Cursor, Claude Desktop, Claude Code…): Google Ads, Meta, LinkedIn, TikTok, Snapchat, Reddit, Microsoft, X, Amazon Ads and Pinterest.

Every write goes through the Orkestria policy engine: **dry-run by default**, optional human approval, spend caps, protected campaigns and a full audit trail.

## Setup

1. Create an account on [orkestria.top](https://orkestria.top) and connect your ad platforms (OAuth).
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

### Hosted (JSON-RPC over HTTP)

No install — point your client at the stable endpoint. Auth uses `Authorization: Bearer ork_...`.

```json
{
  "mcpServers": {
    "orkestria": {
      "url": "https://orkestria.top/api/mcp",
      "headers": {
        "Authorization": "Bearer ork_..."
      }
    }
  }
}
```

Transport is **JSON-RPC HTTP** (`POST` with `application/json`). It is not SSE streamable HTTP; clients that only speak Streamable HTTP may need the local `npx` path instead.

## First steps

Ask your agent:

1. `validate_setup` — checks the key, lists connected platforms and the active policy.
2. `list_campaigns` — reads campaigns across all connected platforms.
3. `execute` with `dry_run: true` — see the diff without touching anything.
4. Re-call `execute` with `dry_run: false` (or use `mode: "live"` on named tools) when ready.

## Tools

| Family | Tools |
| --- | --- |
| Core | `whoami`, `validate_setup`, `list_connections`, `list_ad_accounts` |
| Launch | `create_campaign`, `set_budget`, `create_media_plan`, `create_ad_set`, `create_ad`, `create_audience` |
| Optimize | `update_budget`, `pause_campaign`, `enable_campaign`, `reallocate_budget`, `add_keywords` |
| Create | `generate_ad_copy`, `list_creatives`, `upload_creative` |
| Measure | `get_performance`, `list_campaigns`, `get_account_summary`, `compare_campaigns`, `get_spend`, `detect_anomalies` |
| Govern | `execute`, `list_pending_approvals`, `approve_action`, `reject_action`, `get_audit_log`, `get_policies`, `set_policy` |

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `ORKESTRIA_API_KEY` | — (required) | API key from the dashboard |
| `ORKESTRIA_API_URL` | `https://orkestria.top` | Self-hosted instance URL |

## Safety model

- `read` scope: read-only tools only.
- `write` scope: can execute live writes and approve/reject actions.
- `admin` scope: can edit workspace policies.
- Universal `execute` defaults to `dry_run: true` — nothing is changed until you opt in with `dry_run: false`.
- Every call (read and write) is logged in the workspace audit trail.
