# MCP Server Specification for Advertising Platforms

Standard interface specification for building MCP servers that connect AI tools to advertising platform APIs.

## Required Tools

### `list_campaigns`

List all campaigns in an account with status and basic metrics.

**Parameters:**
- `account_id` (string, required): Platform account identifier
- `status` (string, optional): Filter by status (active, paused, all)
- `date_range` (string, optional): Metrics date range (last_7_days, last_30_days, this_month)

**Returns:** Array of campaign objects with id, name, status, budget, and basic metrics.

### `get_campaign`

Get detailed campaign data including settings, targeting, and performance.

**Parameters:**
- `account_id` (string, required)
- `campaign_id` (string, required)

### `get_metrics`

Pull performance metrics for campaigns, ad groups, or ads.

**Parameters:**
- `account_id` (string, required)
- `entity_type` (string, required): campaign, ad_group, ad
- `entity_id` (string, optional): Specific entity, or all
- `date_start` (string, required): YYYY-MM-DD
- `date_end` (string, required): YYYY-MM-DD
- `metrics` (array, optional): Specific metrics to return

**Returns:** Normalized metrics using the schema from `core/models/metrics.py`.

### `list_audiences`

List available audiences / segments.

### `get_budget`

Current budget allocation and spend pacing.

## Platform-Specific Tools

Beyond the standard interface, add platform-specific tools:

- **Google Ads**: `run_gaql_query`, `get_search_terms`, `get_auction_insights`
- **Meta Ads**: `get_ad_creatives`, `get_audience_insights`, `manage_catalog`
- **Amazon Ads**: `get_search_terms`, `get_asin_report`, `manage_keywords`
- **LinkedIn Ads**: `get_matched_audiences`, `get_lead_gen_forms`

## Auth Integration

MCP servers should use the auth providers from `core/auth/` for consistent credential management.

## Error Handling

Map platform errors to the unified error types in `core/errors/`.
