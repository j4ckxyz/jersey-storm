// GET /api/warnings on Cloudflare Pages. The logic lives in lib/ (shared with api/warnings.js on Vercel).
import { warningsResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

// one cache entry for everyone: ignore any query string
export const onRequestGet = (ctx) => serve(ctx, new URL('/api/warnings', ctx.request.url).toString(), warningsResponse);
