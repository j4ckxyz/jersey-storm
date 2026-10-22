// GET /api/x-avatar?u=…|id=… on Cloudflare Pages. The logic lives in lib/x-avatar.js (shared with Vercel).
import { avatarResponse } from '../../lib/handlers.js';
import { serve } from '../../lib/edge-cache.js';

export const onRequestGet = (ctx) => {
  const url = new URL(ctx.request.url);
  return serve(ctx, url.toString(), () => avatarResponse(url.searchParams));
};
