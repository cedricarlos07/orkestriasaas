# DB schema

Physical split:

| File | Domain |
|------|--------|
| `auth.ts` | Better Auth + organization plugin |
| `app.ts` | App domain (campaigns, chat, connections…) |
| `admin.ts` | Admin / platform |
| `mcp.ts` | API keys, policies, action runs, rate limits |

Always import from `@/db/schema/index` (or `@/db`).

`appRateLimits` is distinct from Better Auth `rateLimit`.
