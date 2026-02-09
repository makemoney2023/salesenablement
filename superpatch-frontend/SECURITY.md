# Security Notes

## Rate Limiting

This application does **not** implement per-route rate limiting within Next.js API routes. Rate limiting should be handled at the infrastructure level:

### Recommended Approaches

1. **Vercel Edge Middleware** (if deployed on Vercel)
   - Use `@vercel/edge-rate-limit` or custom middleware in `middleware.ts`
   - Configure rate limits per route pattern

2. **Supabase Rate Limits**
   - Supabase applies default rate limits to Edge Functions
   - Configure project-level rate limits in the Supabase dashboard

3. **Cloudflare / Reverse Proxy**
   - If using a reverse proxy, configure rate limiting rules there
   - Cloudflare Rate Limiting rules can be applied per URL pattern

### Critical Endpoints to Protect

| Endpoint | Concern | Recommended Limit |
|----------|---------|-------------------|
| `POST /api/bland/calls` | Initiates paid AI calls | 10 req/min per user |
| `POST /api/search/places` | Google Maps API (cost) | 30 req/min per user |
| `POST /api/search/enrich` | Firecrawl API (cost) | 10 req/min per user |
| `POST /api/search/import` | Bulk database writes | 5 req/min per user |
| `POST /api/auth/invite` | User invitation | 5 req/min per user |

### Authentication

All API routes (except webhooks and auth endpoints) now require authentication via `requireApiAuth()`. This is the first line of defense against unauthorized access.

### Webhook Security

The Bland.ai webhook endpoint (`/api/webhooks/bland` and the Supabase Edge Function `webhook-processor`) now verifies webhook signatures when `BLAND_WEBHOOK_SECRET` is configured.

### CORS

Edge Functions use `ALLOWED_ORIGIN` environment variable to restrict cross-origin access. Set this to your production domain.
