# Orkestria MCP

Control ad campaigns from Orkestria (chat + dashboard) or any MCP-compatible agent: **Meta + Google (V1)**, research via Ad Library.

Every write goes through the Orkestria policy engine: **dry-run by default**, optional human approval, spend caps, protected campaigns and a full audit trail.

## V1 stack (Strategy A)

| Layer | Backend |
| --- | --- |
| **Meta create A→Z** | [adkit](https://github.com/jatinjain25/adkit) via `adkit-mcp` (brief, PAUSED, activate) |
| **Google Search/PMax** | [AdLoop self-hosted](https://docs.getadloop.com/quickstart/self-hosted) (`python -m adloop` on server) |
| **Research** | [useproxy](https://mcp.useproxy.ai) Meta Ad Library (read-only) |
| **Policy + audit** | Orkestria only — one gateway |

Call `list_capabilities` first. **Production** today: `google_ads`, `meta_ads`. Other connectors are **experimental**.

## Setup

1. Create an account on [orkestria.top](https://orkestria.top) and connect Meta via OAuth.
2. Optional: connect Google Ads OAuth in **Connexions** to target a specific client account under your MCC.
3. Generate an API key (`ork_...`) from **Dashboard → Clés API**.

### Cursor / Claude (optional — power users)

```json
{
  "mcpServers": {
    "orkestria": {
      "command": "npx",
      "args": ["-y", "orkestria-mcp@1.2.0"],
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

## Tools (highlights)

| Family | Tools |
| --- | --- |
| Core | `validate_setup`, `list_capabilities`, `list_connections`, `list_ad_accounts` |
| Research | `research_competitor_ads` |
| Launch | `create_search_campaign`, `create_pmax_campaign`, `create_meta_campaign`, `launch_meta_brief`, `activate_meta_campaign` |
| Optimize | `update_campaign_budget`, `pause_campaign`, `add_keywords`, `add_negative_keywords` |
| Measure | `get_performance`, `get_daily_spend`, `diagnose_tracking`, `detect_anomalies` |
| Govern | `execute`, `run_tool`, `list_tool_catalog`, `list_skills`, `run_skill`, `autonomy_tick` |

## Safety protocol

1. `validate_setup` / `list_capabilities`
2. `research_competitor_ads` (optional, before create)
3. Measure (`get_performance`, `detect_anomalies`)
4. Propose with `dry_run=true` (default)
5. Re-call with `dry_run=false` after review

Operator charter: [`agents/ad-operator.md`](../../agents/ad-operator.md). Skills: [`skills/*/SKILL.md`](../../skills).

## Environment (server)

| Variable | Description |
| --- | --- |
| `ORKESTRIA_API_KEY` | Client package auth |
| `USEPROXY_BEARER_TOKEN` | OAuth bearer after useproxy connect (Ad Library research) |
| `ADLOOP_MCP_COMMAND` | Default `python3` |
| `ADLOOP_MCP_ARGS` | Default `-m adloop` — requires `pip install adloop && adloop init` on the server |
| `ADLOOP_CONFIG` | Path to `config.yaml` (default `~/.adloop/config.yaml`) |
| `ADKIT_MCP_COMMAND` | Default `adkit-mcp` — requires `pipx install "meta-adkit[mcp]"` on the server |
| `META_PAGE_ID` | Default Facebook Page for adkit briefs |
| `GEMINI_API_KEY` | Optional — adkit AI creative generation |
| `MCP_WRITE_ENABLED` | Global write gate |

Per-org: Meta OAuth + optional Google OAuth (`customer_id` for AdLoop calls).
