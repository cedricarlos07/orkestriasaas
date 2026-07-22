---
name: campaign-manager
description: Launch and structure campaigns across connected platforms under Orkestria policy.
---

# Campaign manager

## Steps

1. `validate_setup` — confirm connections + maturity
2. `research_competitor_ads` — spy Ad Library before creative (useproxy)
3. `create_media_plan` — allocate budget from 30-day perf
4. Meta: `launch_meta_brief` (adkit-mcp) → dry_run → `activate_meta_campaign` when approved
5. Google: `create_search_campaign` / `create_pmax_campaign` (AdLoop self-hosted on server)
6. Writes: dry_run=true then dry_run=false

## Notes

Campaigns stay PAUSED until the owner confirms. Meta via [adkit](https://github.com/jatinjain25/adkit). Google via [AdLoop self-hosted](https://docs.getadloop.com/quickstart/self-hosted).
