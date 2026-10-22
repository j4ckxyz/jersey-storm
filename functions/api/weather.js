// GET /api/weather on Cloudflare Pages. The logic lives in lib/ (shared with api/weather.js on Vercel).
import { weatherResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

// one cache entry for everyone: ignore any query string
export const onRequestGet = (ctx) => serve(ctx, new URL('/api/weather', ctx.request.url).toString(), weatherResponse);
