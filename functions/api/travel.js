// GET /api/travel on Cloudflare Pages. The logic lives in lib/ (shared with api/travel.js on Vercel).
import { travelResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

// one cache entry for everyone: ignore any query string
export const onRequestGet = (ctx) => serve(ctx, new URL('/api/travel', ctx.request.url).toString(), travelResponse);
