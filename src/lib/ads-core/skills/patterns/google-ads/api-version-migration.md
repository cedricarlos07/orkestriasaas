# Google Ads API Version Migration

Google releases a new API version roughly every 3 months and deprecates versions after ~12 months.

## Migration Checklist

1. Check the [version changelog](https://developers.google.com/google-ads/api/docs/release-notes) for breaking changes
2. Update your client library: `pip install --upgrade google-ads`
3. Update the `api_version` in your `google-ads.yaml` configuration
4. Test GAQL queries — field names and enum values sometimes change
5. Update any resource name parsing (format: `customers/{id}/campaigns/{id}`)

## Common Breaking Changes

- Enum value renames (e.g., `SEARCH_STANDARD` → renamed enum)
- Deprecated fields removed
- New required fields added
- Report column name changes

## Pro Tip

Always pin your client library version in `requirements.txt` and test before upgrading production.
