# Meta Business SDK Authentication

## System User Tokens (Production)

For production use, always use System User tokens from Business Manager:

1. Business Settings → System Users → Add
2. Assign assets (Ad Accounts, Pages, Pixels)
3. Generate token with required permissions
4. System User tokens don't expire (unless permissions change)

## User Tokens (Development)

Short-lived (1-2 hours) → Exchange for long-lived (60 days):

```python
from core.auth.meta import MetaAdsAuth

auth = MetaAdsAuth(
    access_token="short_lived_token",
    app_id="your_app_id",
    app_secret="your_app_secret"
)
long_lived = auth.exchange_for_long_lived()
```

## Common Auth Errors

- **Error 190**: Token expired or invalid. Check token debug: `graph.facebook.com/debug_token`
- **Error 10**: App doesn't have Marketing API access. Add Marketing API product in developer console.
- **Error 200**: Insufficient permissions. Check token has `ads_management` scope.
