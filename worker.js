// Entry point for the Workers + Static Assets deployment model.
// This account's Git-connected Cloudflare project builds a native Worker
// (not classic Pages), so the functions/api/*.js files aren't auto-routed
// the way they would be on Pages — this file wires them up by hand and
// falls back to serving the static site for everything else.

import { onRequestGet as geoHandler } from "./functions/api/geo.js";
import { onRequestPost as submitRfqHandler } from "./functions/api/submit-rfq.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API routes are handled the same way regardless of which legacy
    // hostname the page was loaded from. This must come BEFORE the
    // legacy-host redirect below: redirecting a POST cross-origin turns it
    // into a GET (301 semantics) and browsers block the follow-up as a CORS
    // failure, which is exactly what broke the RFQ form on duoyinfo.com.
    if (url.pathname === "/api/geo" && request.method === "GET") {
      return geoHandler({ request, env, ctx });
    }
    if (url.pathname === "/api/submit-rfq" && request.method === "POST") {
      return submitRfqHandler({ request, env, ctx });
    }

    // Every legacy/bare hostname gets sent to the canonical www.duyio.com
    // host for page loads. Handled here in code (not a Cloudflare Redirect
    // Rule) because the rule wasn't firing reliably for this zone — this
    // path is directly testable end to end.
    const LEGACY_HOSTS = new Set([
      "duyio.com",
      "duoyinfo.com",
      "www.duoyinfo.com"
    ]);
    if (LEGACY_HOSTS.has(url.hostname)) {
      url.hostname = "www.duyio.com";
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  }
};
