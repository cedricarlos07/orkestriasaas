---
name: budget-optimizer
description: Reallocate budget toward efficient campaigns under policy caps.
---

# Budget optimizer

## Steps

1. `get_spend` / `get_daily_spend`
2. `compare_campaigns` metric=cpa or conversions
3. Propose moves with expected impact
4. `reallocate_budget` or `update_campaign_budget` — dry_run then confirm
5. Respect spend caps and protected campaigns from `get_policies`
