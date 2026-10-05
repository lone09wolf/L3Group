import { handleEnquiry, jsonResponse } from './enquiry.mjs';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      try {
        const clientIp = request.headers.get('CF-Connecting-IP');
        const rateLimit = env.ENQUIRY_RATE_LIMITER?.limit && clientIp
          ? async () => (await env.ENQUIRY_RATE_LIMITER.limit({ key: `l3-enquiry:${clientIp}` })).success
          : undefined;
        return await handleEnquiry(request, env, { clientIp, rateLimit });
      } catch {
        return jsonResponse(500, { error: 'The enquiry service is unavailable. Please try again shortly.' });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
