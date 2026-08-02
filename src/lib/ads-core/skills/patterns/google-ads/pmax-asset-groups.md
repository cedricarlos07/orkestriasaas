# Performance Max Asset Group Architecture

## Structure Philosophy

Asset groups in PMax are not just creative containers — they're signal-and-audience packages. Each asset group should represent a distinct product/service category AND audience segment.

## Recommended Architecture

```
Campaign: Brand - Performance Max
├── Asset Group: Core Products - High Intent
│   ├── Audience Signal: Purchasers + High-intent search themes
│   ├── Assets: Product-focused headlines, descriptions, images
│   └── Listing Group: Top-selling products
├── Asset Group: Core Products - Prospecting
│   ├── Audience Signal: In-market + affinity audiences
│   ├── Assets: Benefit-focused, broader messaging
│   └── Listing Group: Same products, different signal
└── Asset Group: Accessories - Cross-sell
    ├── Audience Signal: Existing customers
    ├── Assets: Cross-sell messaging
    └── Listing Group: Accessory products only
```

## Asset Requirements

| Asset Type | Min | Max | Recommendation |
|-----------|-----|-----|----------------|
| Headlines (30 char) | 3 | 15 | Provide 10-15 for maximum rotation |
| Long Headlines (90 char) | 1 | 5 | Provide 5 |
| Descriptions (90 char) | 2 | 5 | Provide 4-5 |
| Images (landscape 1.91:1) | 1 | 20 | Provide 5+ |
| Images (square 1:1) | 1 | 20 | Provide 5+ |
| Images (portrait 4:5) | 0 | 20 | Provide 3+ for social placements |
| Logo (1:1) | 1 | 5 | Provide 1-2 |
| Logo (landscape 4:1) | 0 | 5 | Provide 1 |
| Videos | 0 | 5 | Provide at least 1 or Google auto-generates |

## Pro Tips

- **Always provide your own videos.** Auto-generated videos from Google are low quality and waste impressions.
- **Use the Asset Performance labels** (Best, Good, Low) but don't optimize based on less than 2 weeks of data.
- **Search themes** (beta) let you add keyword-like signals without running traditional search campaigns.
- **Exclude brand terms** in account-level brand exclusions if you run a separate brand search campaign.
