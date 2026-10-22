// GET /api/feed on Cloudflare Pages. The logic lives in lib/ (shared with api/feed.js on Vercel).
import { feedResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

// one cache entry for everyone: ignore any query string
export const onRequestGet = (ctx) => serve(ctx, new URL('/api/feed', ctx.request.url).toString(), feedResponse);
