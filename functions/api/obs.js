// GET /api/obs on Cloudflare Pages. The logic lives in lib/ (shared with api/obs.js on Vercel).
import { obsResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

// one cache entry for everyone: ignore any query string
export const onRequestGet = (ctx) => serve(ctx, new URL('/api/obs', ctx.request.url).toString(), obsResponse);
