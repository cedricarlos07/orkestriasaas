# Conversion Action Hierarchy

## Primary vs Secondary Conversions

This is the single most misunderstood concept in Google Ads conversion tracking.

**Primary conversions** are used for bidding optimization. Smart Bidding targets these.
**Secondary conversions** are tracked for reporting only. They don't influence bidding.

### The Common Mistake

Setting every conversion action as "primary" — page views, button clicks, form starts, form completions, purchases — all optimizing simultaneously. The algorithm can't optimize for contradictory goals.

### The Fix

```
Primary (bidding):
  └── Purchase / Lead Submit / Key Business Action

Secondary (observation):
  ├── Add to Cart
  ├── Form Start
  ├── Page View (key pages)
  └── Phone Call Click
```

One primary conversion action per campaign objective. Everything else is secondary.

## Conversion Action Settings That Matter

- **Attribution model**: Data-driven (default and recommended for most accounts)
- **Click-through window**: 30 days default. Shorten for impulse purchases, lengthen for B2B
- **View-through window**: 1 day default. Consider disabling if you care about incrementality
- **Count**: "One" for leads (one form submit = one lead), "Every" for purchases (one visitor can buy 3 times)
