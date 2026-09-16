/*
 * DUYIO site generator.
 *
 * Reads build/data/*.json and writes, for each locale in site.locales:
 *   - index.html                                   (homepage: explore-by-collection hub)
 *   - collections/<slug>/index.html                (one landing page per collection)
 *   - products/phone-cases/<slug>/index.html       (product detail pages)
 *   - sitemap.xml
 *
 * The default locale (site.defaultLocale) ships at the root, unprefixed
 * (URLs unchanged from the single-locale era). Every other locale ships
 * under /<locale>/... (e.g. /es/collections/mexico/).
 *
 * Run: npm run build
 *
 * i18n: every user-facing string in the data files is either a plain string
 * (used as-is in all locales) or a { en: "...", es: "..." } object. t(field,
 * locale) resolves it, falling back to the default locale if a translation
 * is missing. UI chrome strings (nav labels, buttons, etc. — not tied to
 * one JSON record) live in site.json's "ui" block and are resolved with
 * ui(key, locale, vars).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "build", "data");

const site = JSON.parse(readFileSync(join(DATA, "site.json"), "utf8"));
const collections = JSON.parse(readFileSync(join(DATA, "collections.json"), "utf8"));
const products = JSON.parse(readFileSync(join(DATA, "products.json"), "utf8"));

const ORIGIN = site.canonicalOrigin;
const WA_URL = site.contact.whatsappUrl;
const LOCALES = site.locales || ["en"];
const DEFAULT_LOCALE = site.defaultLocale || "en";

/* ---------- i18n helpers ---------- */
// Resolves a data field that is either a plain string (locale-agnostic) or
// a { en, es } object, falling back to the default locale.
function t(field, locale) {
  if (field && typeof field === "object" && !Array.isArray(field)) {
    if (locale in field || DEFAULT_LOCALE in field) {
      return field[locale] ?? field[DEFAULT_LOCALE];
    }
  }
  return field;
}
// Resolves a UI chrome string from site.json's "ui" block, with optional
// {placeholder} interpolation.
function ui(key, locale, vars) {
  const entry = site.ui[key];
  if (!entry) throw new Error(`Missing ui string: ${key}`);
  let s = t(entry, locale);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/* ---------- path helpers ---------- */
// Root-relative output path for a page, per locale (default locale ships
// unprefixed; others ship under /<locale>/...).
const rootPath = {
  home: (locale) => (locale === DEFAULT_LOCALE ? "index.html" : `${locale}/index.html`),
  collection: (locale, slug) =>
    locale === DEFAULT_LOCALE
      ? `collections/${slug}/index.html`
      : `${locale}/collections/${slug}/index.html`,
  product: (locale, slug) =>
    locale === DEFAULT_LOCALE
      ? `products/phone-cases/${slug}/index.html`
      : `${locale}/products/phone-cases/${slug}/index.html`
};
// baseDepth is the directory depth ignoring locale (home=0, collection=2,
// product=3); the locale prefix adds one more level for non-default locales.
const localeDepth = (locale) => (locale === DEFAULT_LOCALE ? 0 : 1);

/* ---------- generic helpers ---------- */
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const up = (depth) => (depth === 0 ? "" : "../".repeat(depth));
const qp = (s) => encodeURIComponent(s);
const write = (outPath, html) => {
  const full = join(ROOT, outPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
  console.log("  wrote", outPath);
};

const collBySlug = Object.fromEntries(collections.map((c) => [c.slug, c]));
const productsByCollection = (slug) =>
  products.filter((p) => p.collection === slug).sort((a, b) => a.order - b.order);
const productBySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
const orderedCollections = [...collections].sort((a, b) => a.order - b.order);

// Builds the per-page linker helpers for a given locale + depth.
//   a(path)     — link to another localized page (index.html, collections/…,
//                 products/…, request-quote.html): gets the locale prefix.
//   asset(path) — link to a shared, non-localized asset (assets/…).
function linkers(locale, depth) {
  const upPath = up(depth);
  const localePrefix = locale === DEFAULT_LOCALE ? "" : `${locale}/`;
  return {
    a: (path) => upPath + localePrefix + path,
    asset: (path) => upPath + path
  };
}

// Bare market/place name for the "Building for the {market} market?"
// collection CTA heading — e.g. "Mexico"/"México", not the adjectival
// "Cultura Mexicana". Country collections carry an explicit `market` field
// since it doesn't derive cleanly from the display name by regex in Spanish
// (Cultura Mexicana -> "Mexicana" reads as an adjective, not "México").
// Aesthetic collections (no dedicated market) fall back to their full name.
function marketName(c, locale) {
  if (c.market) return t(c.market, locale);
  const name = t(c.name, locale);
  return locale === "es" ? name.replace(/^Cultura /, "") : name.replace(/ Culture$/, "");
}

function designCountLabel(n, locale) {
  if (locale === "es") return `${n} diseño${n === 1 ? "" : "s"}`;
  return `${n} design${n === 1 ? "" : "s"}`;
}

/* ---------- shared chrome ---------- */
function head({ locale, depth, rootPaths, title, description, extraJsonLd = "" }) {
  const { asset } = linkers(locale, depth);
  const upPath = up(depth);
  const canonical = `${ORIGIN}/${rootPaths[locale] === "index.html" ? "" : rootPaths[locale].replace(/index\.html$/, "")}`;
  const altLinks = LOCALES.map((loc) => {
    const p = rootPaths[loc];
    const url = `${ORIGIN}/${p === "index.html" ? "" : p.replace(/index\.html$/, "")}`;
    return `<link rel="alternate" hreflang="${loc}" href="${url}" />`;
  }).join("\n");
  const defaultUrl = `${ORIGIN}/${
    rootPaths[DEFAULT_LOCALE] === "index.html" ? "" : rootPaths[DEFAULT_LOCALE].replace(/index\.html$/, "")
  }`;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${canonical}" />
${altLinks}
<link rel="alternate" hreflang="x-default" href="${defaultUrl}" />
<link rel="icon" type="image/png" sizes="32x32" href="${asset("assets/favicon-32.png")}" />
<link rel="icon" type="image/png" sizes="64x64" href="${asset("assets/favicon-64.png")}" />
<link rel="apple-touch-icon" href="${asset("assets/favicon-180.png")}" />
<meta name="theme-color" content="${site.themeColor}" />
<link rel="stylesheet" href="${asset("assets/styles.css")}" />
${extraJsonLd}
</head>
<body>`;
}

function header({ locale, depth, isHome, rootPaths }) {
  const { a, asset } = linkers(locale, depth);
  const home = isHome ? "#top" : a("index.html");
  const otherLocale = LOCALES.find((l) => l !== locale) || locale;
  const switchHref = up(depth) + rootPaths[otherLocale];
  return `
<header class="site">
  <div class="wrap nav-row">
    <a class="logo" href="${home}" aria-label="${esc(ui("duyioHome", locale))}">
      <img src="${asset("assets/logo.png")}" alt="DUYIO" />
    </a>
    <div class="nav-links-wrap">
      <nav class="primary" aria-label="${esc(ui("ariaPrimary", locale))}">
        <a href="${a("index.html")}#collections">${esc(ui("navCollections", locale))}</a>
        <a href="${a("index.html")}#quality">${esc(ui("navQuality", locale))}</a>
        <a href="${a("index.html")}#studio">${esc(ui("navAbout", locale))}</a>
        <a href="${a("index.html")}#contact">${esc(ui("navContact", locale))}</a>
      </nav>
      <a class="lang-switch" href="${switchHref}" hreflang="${otherLocale}">${esc(
    ui("langSwitch", locale)
  )}</a>
      <a class="btn btn-primary btn-nav" href="${a("request-quote.html")}">${esc(
    ui("navRequestQuote", locale)
  )}</a>
    </div>
  </div>
</header>`;
}

function footer({ locale, depth }) {
  const { a } = linkers(locale, depth);
  return `
<footer class="site">
  <div class="wrap footer-row">
    <p class="footer-legal">${esc(site.legalName)} · ${esc(ui("founded", locale))} ${esc(
    site.founded
  )}<br />${esc(site.address.street)}, ${esc(site.address.locality)}, ${esc(
    site.address.region
  )}, ${esc(site.address.postalCode)}, China</p>
    <nav aria-label="${esc(ui("ariaFooter", locale))}">
      <a href="${a("index.html")}#collections">${esc(ui("navCollections", locale))}</a>
      <a href="${a("index.html")}#quality">${esc(ui("navQuality", locale))}</a>
      <a href="${a("index.html")}#studio">${esc(ui("navAbout", locale))}</a>
      <a href="${a("index.html")}#contact">${esc(ui("navContact", locale))}</a>
    </nav>
  </div>
</footer>
</body>
</html>`;
}

function processSection(locale) {
  const p = site.process;
  return `
  <section id="quality">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(t(p.eyebrow, locale))}</p>
        <h2>${esc(t(p.heading, locale))}</h2>
        <p>${esc(t(p.intro, locale))}</p>
      </div>
      <ol class="process-list">
${p.steps
  .map(
    (s) => `        <li class="process-step">
          <span class="num">${esc(s.num)}</span>
          <h3>${esc(t(s.h, locale))}</h3>
          <p>${esc(t(s.p, locale))}</p>
        </li>`
  )
  .join("\n")}
      </ol>
      <p class="process-note">${esc(t(p.note, locale))}</p>
    </div>
  </section>`;
}

function teamSection({ locale, depth }) {
  const team = site.team;
  const { asset } = linkers(locale, depth);
  return `
  <section id="studio">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(t(team.eyebrow, locale))}</p>
        <h2>${esc(t(team.heading, locale))}</h2>
        <p>${esc(t(team.intro, locale))}</p>
      </div>
      <div class="team-grid">
${team.members
  .map(
    (m) => `        <div class="team-card">
          <span class="avatar"><img src="${asset(m.img)}" alt="" loading="lazy" /></span>
          <span class="tname">${esc(m.name)}</span>
          <span class="trole">${esc(t(m.role, locale))}</span>
          <p class="tbio">${esc(t(m.bio, locale))}</p>
        </div>`
  )
  .join("\n")}
      </div>
    </div>
  </section>`;
}

function finalCta({ locale, depth }) {
  const { a } = linkers(locale, depth);
  const c = site.finalCta;
  return `
  <section class="final-cta" id="contact">
    <div class="wrap cta-grid">
      <div>
        <h2>${esc(t(c.heading, locale))}</h2>
        <p>${esc(t(c.body, locale))}</p>
        <div class="cta-actions">
          <a class="btn btn-primary" href="${WA_URL}" target="_blank" rel="noopener">${esc(
    ui("messageWhatsapp", locale)
  )}</a>
          <a class="btn btn-outline" href="${a("request-quote.html")}">${esc(
    ui("requestAQuote", locale)
  )}</a>
        </div>
      </div>
      <div class="cta-contact">
        <div><span class="label">WhatsApp</span><br /><span class="val">${esc(
          site.contact.whatsappNumber
        )}</span></div>
        <div><span class="label">Email</span><br /><span class="val">${esc(
          site.contact.email
        )}</span></div>
        <div><span class="label">Location</span><br /><span class="val">${esc(
          t(site.contact.location, locale)
        )}</span></div>
      </div>
    </div>
  </section>`;
}

/* ---------- homepage ---------- */
function renderHome(locale) {
  const baseDepth = 0;
  const depth = baseDepth + localeDepth(locale);
  const { a, asset } = linkers(locale, depth);
  const rootPaths = Object.fromEntries(LOCALES.map((l) => [l, rootPath.home(l)]));

  const orgLd = `<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.legalName,
    alternateName: site.name,
    url: ORIGIN + "/",
    logo: ORIGIN + "/assets/logo.png",
    foundingDate: site.founded,
    founder: { "@type": "Person", name: site.founder },
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country
    },
    sameAs: []
  },
  null,
  2
)}
</script>`;

  const collCards = orderedCollections
    .map((c) => {
      const items = productsByCollection(c.slug);
      const hero = items[0];
      const heroImg = hero ? `assets/products/${hero.assetDir}/main.jpg` : site.hero.image;
      const n = items.length;
      const name = t(c.name, locale);
      return `        <a class="tile" href="${a("collections/" + c.slug + "/index.html")}" aria-label="${esc(
        name
      )} — ${esc(designCountLabel(n, locale))}">
          <div class="tile-img-wrap" style="aspect-ratio:4/5;">
            <img src="${asset(heroImg)}" alt="${esc(name)} — ${esc(hero ? t(hero.name, locale) : "")}" loading="lazy" width="1200" height="1500" />
          </div>
          <div class="tile-body">
            <span class="tile-sku">${esc(t(c.eyebrow, locale))} · ${esc(designCountLabel(n, locale))}</span>
            <span class="tile-name">${esc(name)}</span>
            <p class="tile-caption">${esc(t(c.blurb, locale))}</p>
          </div>
        </a>`;
    })
    .join("\n");

  const featured = (site.featuredSlugs || [])
    .map((s) => productBySlug[s])
    .filter(Boolean)
    .map((p) => {
      const name = t(p.name, locale);
      return `        <a class="tile" href="${a(
        "products/phone-cases/" + p.slug + "/index.html"
      )}" aria-label="${esc(name)}, ${esc(ui("productWord", locale) || "product")} ${p.sku}">
          <div class="tile-img-wrap" style="aspect-ratio:1/1;">
            <img src="${asset("assets/products/" + p.assetDir + "/main.jpg")}" alt="${esc(
        name
      )}" loading="lazy" width="1200" height="1200" />
          </div>
          <div class="tile-body">
            <span class="tile-sku">#${esc(p.sku)} — ${esc(t(collBySlug[p.collection].name, locale))}</span>
            <span class="tile-name">${esc(name)}</span>
            <p class="tile-caption">${esc(t(p.tagline, locale))}</p>
          </div>
        </a>`;
    })
    .join("\n");

  return `${head({
    locale,
    depth,
    rootPaths,
    title: t(site.seo.homeTitle, locale),
    description: t(site.seo.homeDescription, locale),
    extraJsonLd: orgLd
  })}
${header({ locale, depth, isHome: true, rootPaths })}

<main id="top">

  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${esc(t(site.hero.eyebrow, locale))}</p>
        <h1>${t(site.hero.headlineHtml, locale)}</h1>
        <p class="lede">${esc(t(site.hero.lede, locale))}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#collections">${esc(ui("exploreCollections", locale))}</a>
          <a class="btn btn-outline" href="${a("request-quote.html")}">${esc(ui("requestAQuote", locale))}</a>
        </div>
      </div>
      <div class="hero-visual">
        <img src="${asset(site.hero.image)}" alt="${esc(
    t(site.hero.imageAlt, locale)
  )}" width="1200" height="1200" />
        <span class="hero-tag">${esc(t(site.hero.tag, locale))}</span>
      </div>
    </div>
  </section>

  <div class="trust-bar">
    <div class="wrap trust-grid">
${site.trust
  .map(
    (tr) => `      <div class="trust-item">
        <span class="label">${esc(t(tr.label, locale))}</span>
        <span class="value">${esc(t(tr.value, locale))}</span>
      </div>`
  )
  .join("\n")}
    </div>
  </div>

  <section id="collections">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(ui("exploreByCulture", locale))}</p>
        <h2>${esc(ui("pickAStory", locale))}</h2>
      </div>
      <p class="collections-intro">${esc(ui("collectionsIntro", locale))}</p>
      <div class="collection-grid grid-3">
${collCards}
      </div>
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(ui("featured", locale))}</p>
        <h2>${esc(ui("aFewToStart", locale))}</h2>
      </div>
      <div class="collection-grid grid-4">
${featured}
      </div>
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>
${processSection(locale)}
  <div class="pour-divider"><span></span><span class="bead"></span></div>
${teamSection({ locale, depth })}
${finalCta({ locale, depth })}
</main>
${footer({ locale, depth })}`;
}

/* ---------- collection page ---------- */
function renderCollection(c, locale) {
  const baseDepth = 2;
  const depth = baseDepth + localeDepth(locale);
  const { a, asset } = linkers(locale, depth);
  const rootPaths = Object.fromEntries(LOCALES.map((l) => [l, rootPath.collection(l, c.slug)]));
  const items = productsByCollection(c.slug);
  const name = t(c.name, locale);

  const byMaterial = {};
  for (const p of items) (byMaterial[t(p.materialTag, locale)] ||= []).push(p);
  const materialGroups = Object.keys(byMaterial);
  // Material grouping only earns its keep when it actually collapses several
  // products under a shared material (e.g. Mexico's biodegradable vs.
  // silicone lines). When every product has its own distinct materialTag
  // (e.g. Argentina, where the tag is really a per-product flavor label),
  // grouping produces one product per "group" instead of a real grid — a
  // collection can opt out entirely via `tileColumns`, which also pins the
  // column count instead of deriving it from the item count.
  const groupBy = !c.tileColumns && materialGroups.length > 1 && materialGroups.length < items.length;

  const gridClass = c.tileColumns
    ? `grid-${c.tileColumns}`
    : items.length >= 4
    ? "grid-4"
    : items.length === 3
    ? "grid-3"
    : "grid-2";

  const tile = (p) => {
    const pname = t(p.name, locale);
    return `          <a class="tile" href="${a(
      "products/phone-cases/" + p.slug + "/index.html"
    )}" aria-label="${esc(pname)}, ${esc(ui("productWord", locale) || "product")} ${p.sku}">
            <div class="tile-img-wrap" style="aspect-ratio:1/1;">
              <img src="${asset("assets/products/" + p.assetDir + "/main.jpg")}" alt="${esc(
      pname
    )}" loading="lazy" width="1200" height="1200" />
            </div>
            <div class="tile-body">
              <span class="tile-sku">#${esc(p.sku)} · ${esc(t(p.materialTag, locale))}</span>
              <span class="tile-name">${esc(pname)}</span>
              <p class="tile-caption">${esc(t(p.card, locale) || t(p.tagline, locale))}</p>
            </div>
          </a>`;
  };

  let gridBlocks;
  if (groupBy) {
    gridBlocks = materialGroups
      .map(
        (m) => `      <div class="collection-block">
        <p class="collection-label"><span class="n">${esc(ui("material", locale))}</span> ${esc(m)}</p>
        <div class="collection-grid ${
          byMaterial[m].length === 4 ? "grid-4" : byMaterial[m].length >= 3 ? "grid-3" : "grid-2"
        }">
${byMaterial[m].map(tile).join("\n")}
        </div>
      </div>`
      )
      .join("\n");
  } else {
    gridBlocks = `      <div class="collection-block">
        <div class="collection-grid ${gridClass}">
${items.map(tile).join("\n")}
        </div>
      </div>`;
  }

  const breadcrumbLd = `<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: ui("home", locale), item: ORIGIN + "/" },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: `${ORIGIN}/${rootPaths[locale].replace(/index\.html$/, "")}`
      }
    ]
  },
  null,
  2
)}
</script>`;

  return `${head({
    locale,
    depth,
    rootPaths,
    title: `${name} — ${ui("cultureInspiredCases", locale)} | DUYIO`,
    description: `${name}: ${t(c.blurb, locale)}`,
    extraJsonLd: breadcrumbLd
  })}
${header({ locale, depth, isHome: false, rootPaths })}

<main id="top">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="${esc(ui("ariaBreadcrumb", locale))}">
      <a href="${a("index.html")}">${esc(ui("home", locale))}</a>
      <span class="sep">/</span>
      <span class="current">${esc(name)}</span>
    </nav>
  </div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(t(c.eyebrow, locale))}</p>
        <h2>${esc(name)}</h2>
        <p>${esc(t(c.intro, locale))}</p>
      </div>
${gridBlocks}
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="pdp-cta">
        <h3>${esc(ui("buildingForMarket", locale, { market: marketName(c, locale) }))}</h3>
        <p>${esc(ui("tellUsModels", locale))}</p>
        <div class="product-actions">
          <a class="btn btn-primary" href="${a("request-quote.html")}">${esc(ui("requestAQuote", locale))}</a>
          <a class="btn btn-outline" href="${a("index.html")}#collections">${esc(ui("allCollections", locale))}</a>
        </div>
      </div>
    </div>
  </section>
</main>
${footer({ locale, depth })}`;
}

/* ---------- product page ---------- */
function renderProduct(p, locale) {
  const baseDepth = 3;
  const depth = baseDepth + localeDepth(locale);
  const { a, asset } = linkers(locale, depth);
  const rootPaths = Object.fromEntries(LOCALES.map((l) => [l, rootPath.product(l, p.slug)]));
  const c = collBySlug[p.collection];
  const dir = `assets/products/${p.assetDir}`;
  const name = t(p.name, locale);
  const collName = t(c.name, locale);
  const rq = `${a("request-quote.html")}?product=${qp(name)}&sku=${qp(p.sku)}&src=${p.slug}`;
  const priceStr = p.price.toFixed(2);

  const productLd = `<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: p.sku,
    description: t(p.schemaDescription, locale) || t(p.tagline, locale),
    brand: { "@type": "Brand", name: "DUYIO" },
    image: [`${ORIGIN}/${dir}/main.jpg`],
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: priceStr,
      priceValidUntil: "2026-12-31",
      eligibleQuantity: { "@type": "QuantitativeValue", minValue: 200, unitText: "pcs per model" },
      availability: "https://schema.org/InStock",
      url: `${ORIGIN}/${rootPaths[locale].replace(/index\.html$/, "")}`
    }
  },
  null,
  2
)}
</script>
<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: ui("home", locale), item: ORIGIN + "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: collName,
        item: `${ORIGIN}/${rootPath.collection(locale, c.slug).replace(/index\.html$/, "")}`
      },
      {
        "@type": "ListItem",
        position: 3,
        name,
        item: `${ORIGIN}/${rootPaths[locale].replace(/index\.html$/, "")}`
      }
    ]
  },
  null,
  2
)}
</script>`;

  const story = p.story
    .map((para, i) => `      <p${i === 0 ? ' class="lead"' : ""}>${esc(t(para, locale))}</p>`)
    .join("\n");

  const craft = p.craft
    .map((x) => {
      const h = t(x.h, locale);
      return `        <div class="callout-card">
          <img src="${asset(dir + "/" + x.img)}" alt="${esc(h)}" loading="lazy" />
          <div class="callout-body">
            <h3>${esc(h)}</h3>
            <p>${esc(t(x.p, locale))}</p>
          </div>
        </div>`;
    })
    .join("\n");

  const features = p.features
    .map((x) => {
      const h = t(x.h, locale);
      return `        <div class="callout-card">
          <img src="${asset(dir + "/" + x.img)}" alt="${esc(h)}" loading="lazy" />
          <div class="callout-body">
            <h3>${esc(h)}</h3>
            <p>${esc(t(x.p, locale))}</p>
          </div>
        </div>`;
    })
    .join("\n");

  const galleryImages = p.images.map((img) => ({ key: img.key, alt: t(img.alt, locale) }));
  const galleryJs = JSON.stringify(galleryImages);

  return `${head({
    locale,
    depth,
    rootPaths,
    title: `${name} — #${p.sku} | DUYIO`,
    description: t(p.metaDescription, locale),
    extraJsonLd: productLd
  })}
${header({ locale, depth, isHome: false, rootPaths })}

<main id="top">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="${esc(ui("ariaBreadcrumb", locale))}">
      <a href="${a("index.html")}">${esc(ui("home", locale))}</a>
      <span class="sep">/</span>
      <a href="${a("collections/" + c.slug + "/index.html")}">${esc(collName)}</a>
      <span class="sep">/</span>
      <span class="current">${esc(name)}</span>
    </nav>
  </div>

  <section class="product-hero wrap">
    <div class="product-gallery">
      <div class="gallery-main">
        <img id="gallery-main-img" src="${asset(dir + "/main.jpg")}" alt="${esc(
    name
  )}, ${esc(ui("mainProductShot", locale))}" />
      </div>
      <div class="gallery-thumbs" id="gallery-thumbs"></div>
    </div>

    <div class="product-info">
      <div class="product-title-sku">
        <span class="tile-sku">#${esc(p.sku)} — ${esc(collName)} · ${esc(t(p.materialTag, locale))}</span>
        <h1>${esc(name)}</h1>
      </div>
      <p class="product-tagline">${esc(t(p.tagline, locale))}</p>

      <div class="fact-grid">
        <div class="fact-cell">
          <span class="label">${esc(ui("modelNo", locale))}</span>
          <span class="value">${esc(p.sku)}</span>
        </div>
        <div class="fact-cell">
          <span class="label">${esc(ui("moq", locale))}</span>
          <span class="value">${esc(t(p.moq, locale))}</span>
        </div>
        <div class="fact-cell">
          <span class="label">${esc(ui("material", locale))}</span>
          <span class="value" style="font-family: var(--font-body); font-size: 0.95rem;">${esc(
            t(p.material, locale)
          )}</span>
        </div>
        <div class="fact-cell">
          <span class="label">${esc(ui("leadTime", locale))}</span>
          <span class="value">${esc(t(p.leadTime, locale))}</span>
        </div>
        <div class="fact-cell full">
          <span class="label">${esc(ui("fobPrice", locale))}</span>
          <span class="value">${esc(
            ui("fromPricePerPc", locale, { price: priceStr })
          )} <span style="font-family: var(--font-body); font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">${esc(
    ui("priceNote", locale)
  )}</span></span>
        </div>
      </div>

      <div class="product-actions">
        <a class="btn btn-primary" href="${rq}">${esc(ui("requestAQuote", locale))}</a>
        <a class="btn btn-outline" href="${WA_URL}" target="_blank" rel="noopener">${esc(
    ui("askWhatsapp", locale)
  )}</a>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap story-block">
      <p class="eyebrow">${esc(ui("theDesign", locale))}</p>
${story}
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(ui("craftStructure", locale))}</p>
        <h2>${esc(t(p.craftHeading, locale))}</h2>
      </div>
      <div class="callout-grid">
${craft}
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(ui("keyFeatures", locale))}</p>
        <h2>${esc(t(p.featureHeading, locale) || ui("threeDetails", locale))}</h2>
      </div>
      <div class="feature-strip">
${features}
      </div>
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="compat-banner">
        <img src="${asset(dir + "/" + p.compat.img)}" alt="${esc(name)} ${esc(
    ui("shownFittedToPhone", locale)
  )}" loading="lazy" />
        <div class="compat-copy">
          <p class="eyebrow">${esc(ui("compatibility", locale))}</p>
          <h3>${esc(t(p.compat.heading, locale))}</h3>
          <p>${esc(t(p.compat.text, locale))}</p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="pdp-cta">
        <h3>${esc(ui("wantThisDesign", locale))}</h3>
        <p>${esc(ui("tellUsModels", locale))}</p>
        <div class="product-actions">
          <a class="btn btn-primary" href="${rq}">${esc(ui("requestAQuote", locale))}</a>
          <a class="btn btn-outline" href="${a("collections/" + c.slug + "/index.html")}">${esc(
    ui("moreCollection", locale, { collection: collName })
  )}</a>
        </div>
      </div>
    </div>
  </section>
</main>
${footer({ locale, depth })}

<script>
  var DIR = "${asset(dir)}/";
  var IMAGES = ${galleryJs};
  var mainImg = document.getElementById("gallery-main-img");
  var thumbWrap = document.getElementById("gallery-thumbs");
  IMAGES.forEach(function (img, i) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = i === 0 ? "active" : "";
    btn.setAttribute("aria-label", img.alt);
    var thumb = document.createElement("img");
    thumb.src = DIR + img.key + ".jpg";
    thumb.alt = ""; thumb.loading = "lazy";
    btn.appendChild(thumb);
    btn.addEventListener("click", function () {
      mainImg.src = DIR + img.key + ".jpg";
      mainImg.alt = img.alt;
      thumbWrap.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
    thumbWrap.appendChild(btn);
  });
</script>
`;
}

/* ---------- sitemap ---------- */
function renderSitemap() {
  const pages = [
    ...LOCALES.map((l) => rootPath.home(l)),
    ...orderedCollections.flatMap((c) => LOCALES.map((l) => rootPath.collection(l, c.slug))),
    ...products.flatMap((p) => LOCALES.map((l) => rootPath.product(l, p.slug)))
  ];
  const urls = pages.map((p) => `${ORIGIN}/${p.replace(/index\.html$/, "")}`);
  urls.push(`${ORIGIN}/request-quote.html`);
  if (LOCALES.includes("es")) urls.push(`${ORIGIN}/es/request-quote.html`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
}

/* ---------- run ---------- */
console.log("Building DUYIO site…");

// Clean generated collection pages (product/index/locale pages are
// overwritten in place; the locale subdirectories are fully regenerated).
const collDir = join(ROOT, "collections");
if (existsSync(collDir)) rmSync(collDir, { recursive: true, force: true });
for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;
  const localeDir = join(ROOT, locale);
  if (existsSync(localeDir)) rmSync(localeDir, { recursive: true, force: true });
}

for (const locale of LOCALES) {
  write(rootPath.home(locale), renderHome(locale));
  for (const c of collections) write(rootPath.collection(locale, c.slug), renderCollection(c, locale));
  for (const p of products) write(rootPath.product(locale, p.slug), renderProduct(p, locale));
}
write("sitemap.xml", renderSitemap());

console.log(
  `Done. ${LOCALES.length} locale(s), ${collections.length} collections, ${products.length} products.`
);
