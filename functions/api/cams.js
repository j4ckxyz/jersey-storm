// GET /api/cams on Cloudflare Pages. The logic lives in lib/ (shared with api/cams.js on Vercel).
import { camsResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

// one cache entry for everyone: ignore any query string
export const onRequestGet = (ctx) => serve(ctx, new URL('/api/cams', ctx.request.url).toString(), camsResponse);
