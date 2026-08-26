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

    // Every legacy/bare hostname gets sent to the canonical www.duyio.com
    // host. Handled here in code (not a Cloudflare Redirect Rule) because
    // the rule wasn't firing reliably for this zone — this path is directly
    // testable end to end.
    const LEGACY_HOSTS = new Set([
      "duyio.com",
      "duoyinfo.com",
      "www.duoyinfo.com"
    ]);
    if (LEGACY_HOSTS.has(url.hostname)) {
      url.hostname = "www.duyio.com";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/geo" && request.method === "GET") {
      return geoHandler({ request, env, ctx });
    }
    if (url.pathname === "/api/submit-rfq" && request.method === "POST") {
      return submitRfqHandler({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  }
};
