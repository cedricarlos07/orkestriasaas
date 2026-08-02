# Conversions API (CAPI) Deduplication

## The Problem

When you send conversions via both the Meta Pixel (browser) AND Conversions API (server), you get double-counted conversions unless you deduplicate.

## The Solution: event_id

Send the same `event_id` with both the Pixel event and the CAPI event. Meta deduplicates based on matching `event_id` + `event_name` within a 48-hour window.

### Browser (Pixel)

```javascript
fbq('track', 'Purchase', {
  value: 99.99,
  currency: 'USD',
}, {eventID: 'purchase_abc123'});
```

### Server (CAPI)

```python
from facebook_business.adobjects.serverside.event import Event
from facebook_business.adobjects.serverside.event_request import EventRequest

event = Event(
    event_name='Purchase',
    event_time=int(time.time()),
    event_id='purchase_abc123',  # Same ID as browser
    user_data=user_data,
    custom_data=custom_data,
)
```

## Gotchas

- `event_id` must be unique per event occurrence, not per event type
- The 48-hour dedup window means late server events still get deduped
- Test Mode in Events Manager shows both events — check the dedup column
- If you see ~2x conversions after CAPI setup, dedup is likely broken
