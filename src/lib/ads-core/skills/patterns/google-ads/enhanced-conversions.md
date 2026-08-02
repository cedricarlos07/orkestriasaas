# Enhanced Conversions Setup

Enhanced conversions improve conversion measurement accuracy by securely sending hashed first-party data alongside your conversion tags.

## The Gotchas Nobody Documents

1. **Enhanced conversions for leads vs web**: These are two different features. "For web" hashes user data from your site. "For leads" matches offline conversion imports. Most advertisers need both.

2. **You must accept the customer data terms** in Google Ads UI before the API will work. Settings → Measurement → Customer data terms. This blocks many programmatic setups.

3. **SHA-256 hashing must happen before sending**: The API accepts pre-hashed data. Don't send plaintext — Google will hash it again and it won't match.

4. **Email normalization matters**: `John.Smith@Gmail.com` and `john.smith@gmail.com` produce different hashes. Always: lowercase, trim whitespace, remove dots from Gmail usernames.

5. **GTM implementation path**: Use the built-in "Google Ads User-Provided Data" variable type in GTM. Don't try to build custom JavaScript variables for this — the built-in handles normalization and hashing.

## Implementation via GTM

1. Google Ads conversion tag → Enable "Include user-provided data from your website"
2. Map data layer variables or CSS selectors to: email, phone, first_name, last_name, street_address, city, region, postal_code, country
3. The tag handles normalization and hashing automatically

## Implementation via API

```python
from google.ads.googleads.client import GoogleAdsClient

conversion_upload_service = client.get_service("ConversionUploadService")

# User identifiers must be SHA-256 hashed
import hashlib
email_hash = hashlib.sha256("john@example.com".lower().strip().encode()).hexdigest()

click_conversion = client.get_type("ClickConversion")
click_conversion.gclid = "your_gclid"
click_conversion.conversion_action = f"customers/{customer_id}/conversionActions/{conversion_action_id}"
click_conversion.conversion_date_time = "2024-01-15 10:30:00-05:00"
click_conversion.conversion_value = 100.0

user_identifier = client.get_type("UserIdentifier")
user_identifier.hashed_email = email_hash
click_conversion.user_identifiers.append(user_identifier)
```

## Verification

After setup, check the "Diagnostics" tab in your conversion action settings. It takes 48-72 hours for enhanced conversion data to appear. Look for the "enhanced conversions" tag in the diagnostics report.
