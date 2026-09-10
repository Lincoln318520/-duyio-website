/*
 * DUYIO site generator.
 *
 * Reads build/data/*.json and writes:
 *   - index.html                                   (homepage: explore-by-collection hub)
 *   - collections/<slug>/index.html                (one landing page per collection)
 *   - products/phone-cases/<slug>/index.html       (product detail pages — URLs unchanged)
 *   - sitemap.xml
 *
 * Run: npm run build
 *
 * i18n: site.json.locales drives which locales are emitted. Only "en" ships today;
 * "es" pages would render under /es/... once Spanish strings are added to the data
 * (each string becomes { en: "...", es: "..." } and t() picks the active locale).
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

/* ---------- helpers ---------- */
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const rel = (depth, path) => (depth === 0 ? path : "../".repeat(depth) + path);
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

/* ---------- shared chrome ---------- */
function head({ depth, title, description, extraJsonLd = "" }) {
  const a = (p) => rel(depth, p);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="icon" type="image/png" sizes="32x32" href="${a("assets/favicon-32.png")}" />
<link rel="icon" type="image/png" sizes="64x64" href="${a("assets/favicon-64.png")}" />
<link rel="apple-touch-icon" href="${a("assets/favicon-180.png")}" />
<meta name="theme-color" content="${site.themeColor}" />
<link rel="stylesheet" href="${a("assets/styles.css")}" />
${extraJsonLd}
</head>
<body>`;
}

function header(depth) {
  const a = (p) => rel(depth, p);
  const home = depth === 0 ? "#top" : a("index.html");
  return `
<header class="site">
  <div class="wrap nav-row">
    <a class="logo" href="${home}" aria-label="DUYIO home">
      <img src="${a("assets/logo.png")}" alt="DUYIO" />
    </a>
    <div class="nav-links-wrap">
      <nav class="primary" aria-label="Primary">
        <a href="${a("index.html")}#collections">Collections</a>
        <a href="${a("index.html")}#quality">Design &amp; Quality</a>
        <a href="${a("index.html")}#studio">About</a>
        <a href="${a("index.html")}#contact">Contact</a>
      </nav>
      <a class="btn btn-primary btn-nav" href="${a("request-quote.html")}">Request Quote</a>
    </div>
  </div>
</header>`;
}

function footer(depth) {
  const a = (p) => rel(depth, p);
  return `
<footer class="site">
  <div class="wrap footer-row">
    <p class="footer-legal">${esc(site.legalName)} · Founded ${site.founded}<br />${esc(
    site.address.street
  )}, ${esc(site.address.locality)}, ${esc(site.address.region)}, ${esc(
    site.address.postalCode
  )}, China</p>
    <nav aria-label="Footer">
      <a href="${a("index.html")}#collections">Collections</a>
      <a href="${a("index.html")}#quality">Design &amp; Quality</a>
      <a href="${a("index.html")}#studio">About</a>
      <a href="${a("index.html")}#contact">Contact</a>
    </nav>
  </div>
</footer>
</body>
</html>`;
}

function processSection() {
  const p = site.process;
  return `
  <section id="quality">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(p.eyebrow)}</p>
        <h2>${esc(p.heading)}</h2>
        <p>${esc(p.intro)}</p>
      </div>
      <ol class="process-list">
${p.steps
  .map(
    (s) => `        <li class="process-step">
          <span class="num">${esc(s.num)}</span>
          <h3>${esc(s.h)}</h3>
          <p>${esc(s.p)}</p>
        </li>`
  )
  .join("\n")}
      </ol>
      <p class="process-note">${esc(p.note)}</p>
    </div>
  </section>`;
}

function teamSection() {
  const t = site.team;
  return `
  <section id="studio">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(t.eyebrow)}</p>
        <h2>${esc(t.heading)}</h2>
        <p>${esc(t.intro)}</p>
      </div>
      <div class="team-grid">
${t.members
  .map(
    (m) => `        <div class="team-card">
          <span class="avatar"><img src="${m.img}" alt="" loading="lazy" /></span>
          <span class="tname">${esc(m.name)}</span>
          <span class="trole">${esc(m.role)}</span>
          <p class="tbio">${esc(m.bio)}</p>
        </div>`
  )
  .join("\n")}
      </div>
    </div>
  </section>`;
}

function finalCta(depth) {
  const a = (p) => rel(depth, p);
  const c = site.finalCta;
  return `
  <section class="final-cta" id="contact">
    <div class="wrap cta-grid">
      <div>
        <h2>${esc(c.heading)}</h2>
        <p>${esc(c.body)}</p>
        <div class="cta-actions">
          <a class="btn btn-primary" href="${WA_URL}" target="_blank" rel="noopener">Message on WhatsApp</a>
          <a class="btn btn-outline" href="${a("request-quote.html")}">Request a Quote</a>
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
          site.contact.location
        )}</span></div>
      </div>
    </div>
  </section>`;
}

/* ---------- homepage ---------- */
function renderHome() {
  const depth = 0;
  const a = (p) => rel(depth, p);
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
      return `        <a class="tile" href="${a("collections/" + c.slug + "/index.html")}" aria-label="${esc(
        c.name
      )} collection, ${n} design${n === 1 ? "" : "s"}">
          <div class="tile-img-wrap" style="aspect-ratio:4/5;">
            <img src="${a(heroImg)}" alt="${esc(c.name)} — ${esc(hero ? hero.name : "")}" loading="lazy" width="1200" height="1500" />
          </div>
          <div class="tile-body">
            <span class="tile-sku">${esc(c.eyebrow)} · ${n} design${n === 1 ? "" : "s"}</span>
            <span class="tile-name">${esc(c.name)}</span>
            <p class="tile-caption">${esc(c.blurb)}</p>
          </div>
        </a>`;
    })
    .join("\n");

  const featured = (site.featuredSlugs || [])
    .map((s) => productBySlug[s])
    .filter(Boolean)
    .map(
      (p) => `        <a class="tile" href="${a(
        "products/phone-cases/" + p.slug + "/index.html"
      )}" aria-label="${esc(p.name)}, product ${p.sku}">
          <div class="tile-img-wrap" style="aspect-ratio:1/1;">
            <img src="${a("assets/products/" + p.assetDir + "/main.jpg")}" alt="${esc(
        p.name
      )}" loading="lazy" width="1200" height="1200" />
          </div>
          <div class="tile-body">
            <span class="tile-sku">#${esc(p.sku)} — ${esc(collBySlug[p.collection].name)}</span>
            <span class="tile-name">${esc(p.name)}</span>
            <p class="tile-caption">${esc(p.tagline)}</p>
          </div>
        </a>`
    )
    .join("\n");

  return `${head({
    depth,
    title: "DUYIO — Original Design, Managed Production for Accessories & Gifts",
    description:
      "DUYIO designs original, culture-inspired accessories and gifts in Guangzhou and manages production through a 500+ factory network across China — from concept to finished order.",
    extraJsonLd: orgLd
  })}
${header(depth)}

<main id="top">

  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${esc(site.hero.eyebrow)}</p>
        <h1>${site.hero.headlineHtml}</h1>
        <p class="lede">${esc(site.hero.lede)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#collections">Explore Collections →</a>
          <a class="btn btn-outline" href="${a("request-quote.html")}">Request a Quote</a>
        </div>
      </div>
      <div class="hero-visual">
        <img src="${a(site.hero.image)}" alt="${esc(
    site.hero.imageAlt
  )}" width="1200" height="1200" />
        <span class="hero-tag">${esc(site.hero.tag)}</span>
      </div>
    </div>
  </section>

  <div class="trust-bar">
    <div class="wrap trust-grid">
${site.trust
  .map(
    (t) => `      <div class="trust-item">
        <span class="label">${esc(t.label)}</span>
        <span class="value">${esc(t.value)}</span>
      </div>`
  )
  .join("\n")}
    </div>
  </div>

  <section id="collections">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Explore by Culture</p>
        <h2>Pick a story, then a design.</h2>
      </div>
      <p class="collections-intro">Every collection is built around one culture or one aesthetic idea — not a warehouse of unrelated SKUs. Start with the market you sell into.</p>
      <div class="collection-grid grid-3">
${collCards}
      </div>
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Featured</p>
        <h2>A few to start with.</h2>
      </div>
      <div class="collection-grid grid-4">
${featured}
      </div>
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>
${processSection()}
  <div class="pour-divider"><span></span><span class="bead"></span></div>
${teamSection()}
${finalCta(depth)}
</main>
${footer(depth)}`;
}

/* ---------- collection page ---------- */
function renderCollection(c) {
  const depth = 2;
  const a = (p) => rel(depth, p);
  const items = productsByCollection(c.slug);

  const byMaterial = {};
  for (const p of items) (byMaterial[p.materialTag] ||= []).push(p);
  const materialGroups = Object.keys(byMaterial);
  const groupBy = materialGroups.length > 1;

  const gridClass = items.length >= 4 ? "grid-4" : items.length === 3 ? "grid-3" : "grid-2";

  const tile = (p) => `          <a class="tile" href="${a(
    "products/phone-cases/" + p.slug + "/index.html"
  )}" aria-label="${esc(p.name)}, product ${p.sku}">
            <div class="tile-img-wrap" style="aspect-ratio:1/1;">
              <img src="${a("assets/products/" + p.assetDir + "/main.jpg")}" alt="${esc(
    p.name
  )}" loading="lazy" width="1200" height="1200" />
            </div>
            <div class="tile-body">
              <span class="tile-sku">#${esc(p.sku)} · ${esc(p.materialTag)}</span>
              <span class="tile-name">${esc(p.name)}</span>
              <p class="tile-caption">${esc(p.card || p.tagline)}</p>
            </div>
          </a>`;

  let gridBlocks;
  if (groupBy) {
    gridBlocks = materialGroups
      .map(
        (m) => `      <div class="collection-block">
        <p class="collection-label"><span class="n">Material</span> ${esc(m)}</p>
        <div class="collection-grid ${byMaterial[m].length >= 3 ? "grid-3" : "grid-2"}">
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
      { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: c.name,
        item: `${ORIGIN}/collections/${c.slug}/`
      }
    ]
  },
  null,
  2
)}
</script>`;

  return `${head({
    depth,
    title: `${c.name} — Culture-Inspired Phone Cases | DUYIO`,
    description: `${c.name}: ${c.blurb}`,
    extraJsonLd: breadcrumbLd
  })}
${header(depth)}

<main id="top">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${a("index.html")}">Home</a>
      <span class="sep">/</span>
      <span class="current">${esc(c.name)}</span>
    </nav>
  </div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(c.eyebrow)}</p>
        <h2>${esc(c.name)}</h2>
        <p>${esc(c.intro)}</p>
      </div>
${gridBlocks}
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="pdp-cta">
        <h3>Building for the ${esc(c.name.replace(/ Culture$/, ""))} market?</h3>
        <p>Tell us your target models, quantities and timeline — we'll confirm pricing and get a sample moving.</p>
        <div class="product-actions">
          <a class="btn btn-primary" href="${a("request-quote.html")}">Request a Quote</a>
          <a class="btn btn-outline" href="${a("index.html")}#collections">All Collections</a>
        </div>
      </div>
    </div>
  </section>
</main>
${footer(depth)}`;
}

/* ---------- product page ---------- */
function renderProduct(p) {
  const depth = 3;
  const a = (path) => rel(depth, path);
  const c = collBySlug[p.collection];
  const dir = `assets/products/${p.assetDir}`;
  const rq = `${a("request-quote.html")}?product=${qp(p.name)}&sku=${qp(p.sku)}&src=${p.slug}`;
  const priceStr = p.price.toFixed(2);

  const productLd = `<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    description: p.schemaDescription || p.tagline,
    brand: { "@type": "Brand", name: "DUYIO" },
    image: [`${ORIGIN}/${dir}/main.jpg`],
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: priceStr,
      priceValidUntil: "2026-12-31",
      eligibleQuantity: { "@type": "QuantitativeValue", minValue: 200, unitText: "pcs per model" },
      availability: "https://schema.org/InStock",
      url: `${ORIGIN}/products/phone-cases/${p.slug}/`
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
      { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
      { "@type": "ListItem", position: 2, name: c.name, item: `${ORIGIN}/collections/${c.slug}/` },
      {
        "@type": "ListItem",
        position: 3,
        name: p.name,
        item: `${ORIGIN}/products/phone-cases/${p.slug}/`
      }
    ]
  },
  null,
  2
)}
</script>`;

  const story = p.story
    .map((para, i) => `      <p${i === 0 ? ' class="lead"' : ""}>${esc(para)}</p>`)
    .join("\n");

  const craft = p.craft
    .map(
      (x) => `        <div class="callout-card">
          <img src="${a(dir + "/" + x.img)}" alt="${esc(x.h)}" loading="lazy" />
          <div class="callout-body">
            <h3>${esc(x.h)}</h3>
            <p>${esc(x.p)}</p>
          </div>
        </div>`
    )
    .join("\n");

  const features = p.features
    .map(
      (x) => `        <div class="callout-card">
          <img src="${a(dir + "/" + x.img)}" alt="${esc(x.h)}" loading="lazy" />
          <div class="callout-body">
            <h3>${esc(x.h)}</h3>
            <p>${esc(x.p)}</p>
          </div>
        </div>`
    )
    .join("\n");

  const galleryJs = JSON.stringify(p.images);

  return `${head({
    depth,
    title: `${p.name} — #${p.sku} | DUYIO`,
    description: p.metaDescription,
    extraJsonLd: productLd
  })}
${header(depth)}

<main id="top">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${a("index.html")}">Home</a>
      <span class="sep">/</span>
      <a href="${a("collections/" + c.slug + "/index.html")}">${esc(c.name)}</a>
      <span class="sep">/</span>
      <span class="current">${esc(p.name)}</span>
    </nav>
  </div>

  <section class="product-hero wrap">
    <div class="product-gallery">
      <div class="gallery-main">
        <img id="gallery-main-img" src="${a(dir + "/main.jpg")}" alt="${esc(
    p.name
  )}, main product shot" />
      </div>
      <div class="gallery-thumbs" id="gallery-thumbs"></div>
    </div>

    <div class="product-info">
      <div class="product-title-sku">
        <span class="tile-sku">#${esc(p.sku)} — ${esc(c.name)} · ${esc(p.materialTag)}</span>
        <h1>${esc(p.name)}</h1>
      </div>
      <p class="product-tagline">${esc(p.tagline)}</p>

      <div class="fact-grid">
        <div class="fact-cell">
          <span class="label">Model No.</span>
          <span class="value">${esc(p.sku)}</span>
        </div>
        <div class="fact-cell">
          <span class="label">MOQ</span>
          <span class="value">${esc(p.moq)}</span>
        </div>
        <div class="fact-cell">
          <span class="label">Material</span>
          <span class="value" style="font-family: var(--font-body); font-size: 0.95rem;">${esc(
            p.material
          )}</span>
        </div>
        <div class="fact-cell">
          <span class="label">Lead Time</span>
          <span class="value">${esc(p.leadTime)}</span>
        </div>
        <div class="fact-cell full">
          <span class="label">FOB Price (USD)</span>
          <span class="value">From $${priceStr} / pc <span style="font-family: var(--font-body); font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">at MOQ — final price depends on order quantity and customization</span></span>
        </div>
      </div>

      <div class="product-actions">
        <a class="btn btn-primary" href="${rq}">Request a Quote</a>
        <a class="btn btn-outline" href="${WA_URL}" target="_blank" rel="noopener">Ask on WhatsApp</a>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap story-block">
      <p class="eyebrow">The Design</p>
${story}
    </div>
  </section>

  <div class="pour-divider"><span></span><span class="bead"></span></div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Craft &amp; Structure</p>
        <h2>${esc(p.craftHeading)}</h2>
      </div>
      <div class="callout-grid">
${craft}
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Key Features</p>
        <h2>${esc(p.featureHeading || "Three details that carry the design.")}</h2>
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
        <img src="${a(dir + "/" + p.compat.img)}" alt="${esc(p.name)} shown fitted to a phone" loading="lazy" />
        <div class="compat-copy">
          <p class="eyebrow">Compatibility</p>
          <h3>${esc(p.compat.heading)}</h3>
          <p>${esc(p.compat.text)}</p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="pdp-cta">
        <h3>Want this design, or something like it?</h3>
        <p>Tell us your target models, quantities and timeline — we'll confirm pricing and get a sample moving.</p>
        <div class="product-actions">
          <a class="btn btn-primary" href="${rq}">Request a Quote</a>
          <a class="btn btn-outline" href="${a("collections/" + c.slug + "/index.html")}">More ${esc(
    c.name
  )}</a>
        </div>
      </div>
    </div>
  </section>
</main>
${footer(depth)}

<script>
  var DIR = "${a(dir)}/";
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
  const urls = [
    `${ORIGIN}/`,
    `${ORIGIN}/request-quote.html`,
    ...orderedCollections.map((c) => `${ORIGIN}/collections/${c.slug}/`),
    ...products.map((p) => `${ORIGIN}/products/phone-cases/${p.slug}/`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
}

/* ---------- run ---------- */
console.log("Building DUYIO site…");

// Clean generated collection pages (product/index pages are overwritten in place).
const collDir = join(ROOT, "collections");
if (existsSync(collDir)) rmSync(collDir, { recursive: true, force: true });

write("index.html", renderHome());
for (const c of collections) write(`collections/${c.slug}/index.html`, renderCollection(c));
for (const p of products) write(`products/phone-cases/${p.slug}/index.html`, renderProduct(p));
write("sitemap.xml", renderSitemap());

console.log(
  `Done. ${collections.length} collections, ${products.length} products.`
);
