// Cloudflare Pages Function: GET /api/geo
// Returns the visitor's ISO 3166-1 alpha-2 country code from Cloudflare's
// edge request metadata (request.cf.country) — free, no third-party geo-IP
// service needed. Only works once deployed to Cloudflare Pages; there is no
// `request.cf` when this file isn't running on Cloudflare's network.

export async function onRequestGet(context) {
  const country = context.request.cf && context.request.cf.country
    ? context.request.cf.country
    : null;

  return new Response(JSON.stringify({ country }), {
    headers: { "content-type": "application/json" }
  });
}
