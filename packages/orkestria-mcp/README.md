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

### Hosted (Streamable HTTP)

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

Transport: **Streamable HTTP** (`Accept: text/event-stream`, `Mcp-Session-Id`) with **JSON-RPC HTTP** fallback (`application/json`).

## Tools (highlights)

| Family | Tools |
| --- | --- |
| Launch | `create_campaign`, `create_search_campaign`, `create_pmax_campaign`, `create_ad_set`, `create_ad`, `create_audience`, `create_conversion` |
| Optimize | `update_budget`, `pause_campaign`, `add_keywords`, `add_negative_keywords`, `reallocate_budget` |
| Measure | `get_performance`, `list_conversions`, `diagnose_tracking`, `detect_anomalies` |
| Govern | `execute`, `list_skills`, `run_skill`, `autonomy_tick`, approvals, policies |

## Safety

- `execute` defaults to `dry_run: true` — confirm with `dry_run: false`
- Autonomy is opt-in (`autonomyEnabled`) and never creates campaigns
- Skills (`launch`, `optimize`, `audit`) return step plans only

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `ORKESTRIA_API_KEY` | — (required) | API key from the dashboard |
| `ORKESTRIA_API_URL` | `https://orkestria.top` | Self-hosted instance URL |
