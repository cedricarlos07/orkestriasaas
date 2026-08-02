# GAQL Query Patterns

Essential Google Ads Query Language patterns every advertiser needs. These work with the Google Ads API reporting endpoint and the [google-ads-mcp](https://github.com/itallstartedwithaidea/google-ads-mcp) server.

## Campaign Performance (Last 30 Days)

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign_budget.amount_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.search_impression_share
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
```

## Search Term Report (Wasted Spend Finder)

```sql
SELECT
  search_term_view.search_term,
  search_term_view.status,
  campaign.name,
  ad_group.name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.all_conversions
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
  AND metrics.cost_micros > 0
  AND metrics.conversions < 1
ORDER BY metrics.cost_micros DESC
LIMIT 100
```

## Auction Insights Comparison

```sql
SELECT
  campaign.name,
  metrics.auction_insight_search_impression_share,
  metrics.auction_insight_search_overlap_rate,
  metrics.auction_insight_search_outranking_share,
  metrics.auction_insight_search_top_impression_percentage,
  metrics.auction_insight_search_absolute_top_impression_percentage
FROM campaign
WHERE campaign.status = 'ENABLED'
  AND segments.date DURING LAST_30_DAYS
```

## Quality Score Distribution

```sql
SELECT
  ad_group_criterion.keyword.text,
  ad_group_criterion.quality_info.quality_score,
  ad_group_criterion.quality_info.creative_quality_score,
  ad_group_criterion.quality_info.post_click_quality_score,
  ad_group_criterion.quality_info.search_predicted_ctr,
  metrics.cost_micros,
  metrics.impressions
FROM keyword_view
WHERE ad_group_criterion.status = 'ENABLED'
  AND campaign.status = 'ENABLED'
ORDER BY metrics.cost_micros DESC
```

## Performance Max Asset Group Performance

```sql
SELECT
  campaign.name,
  asset_group.name,
  asset_group.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM asset_group
WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
  AND segments.date DURING LAST_30_DAYS
```

## Budget Pacing Check

```sql
SELECT
  campaign.name,
  campaign_budget.amount_micros,
  campaign_budget.total_amount_micros,
  metrics.cost_micros,
  campaign.status
FROM campaign
WHERE campaign.status = 'ENABLED'
  AND segments.date = TODAY
```

## Pro Tips

- `cost_micros` is in millionths: divide by 1,000,000 to get dollars
- `DURING LAST_30_DAYS` excludes today; use `DURING TODAY` for today
- `search_impression_share` is a rate (0.0-1.0), not a percentage
- `conversions` vs `all_conversions`: the former respects your conversion action settings
- Always filter `campaign.status != 'REMOVED'` unless you need historical data
