/*
 * One-off: turn the Meitu DesignKit master images for the 14 Mexico-collection
 * silicone laser-engraved cases into web-optimised JPEGs under assets/products/<dir>/.
 *
 * Source masters live outside this repo (the design working folder) and are not
 * committed; only the resized web copies are. Re-run only if a master changes.
 *
 * Run: node build/optimize-mexico-silicone-images.mjs
 */
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = "J:/Claude/Claude-Trading/官网建设";
const SRC_BASE =
  "J:/Claude/Claude-Trading/产品设计/创造元素启发/墨西哥/硅胶手机壳镭雕图案-墨西哥系列/生成图片";
const MAX = 1400;
const QUALITY = 80;

// Position order in each product's 电商图 folder: main_1..6, detail_1..6.
const KEY_ORDER = [
  "main",
  "texture",
  "scene-culture",
  "fleece",
  "colors",
  "hold",
  "meaning",
  "material",
  "durability",
  "protection",
  "lifestyle",
  "sizes"
];

const MAP = {
  "catrina-calavera-silicone": "01_catrina_calavera",
  "papel-picado-silicone": "02_papel_picado",
  "talavera-tile-silicone": "03_talavera_tile",
  "lucha-libre-mask-silicone": "04_lucha_libre_mask",
  "sarape-stripe-silicone": "05_sarape_stripe",
  "cempasuchil-marigold-silicone": "06_cempasuchil_marigold",
  "milagros-folk-charms-silicone": "07_milagros_folk_charms",
  "quetzalcoatl-silicone": "08_quetzalcoatl",
  "barro-negro-silicone": "09_barro_negro",
  "eagle-nopal-cactus-silicone": "10_eagle_nopal_cactus",
  "aztec-geometry-silicone": "11_aztec_geometry",
  "alebrijes-art-silicone": "12_alebrijes_art",
  "mayan-glyphs-silicone": "13_mayan_glyphs",
  "floral-embroidery-otomi-silicone": "14_floral_embroidery_otomi"
};

function sortImages(files) {
  return [...files].sort((a, b) => {
    const ma = a.match(/_(main|detail)_(\d+)_/);
    const mb = b.match(/_(main|detail)_(\d+)_/);
    const ra = ma && ma[1] === "main" ? 0 : 1;
    const rb = mb && mb[1] === "main" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const na = ma ? parseInt(ma[2], 10) : 99;
    const nb = mb ? parseInt(mb[2], 10) : 99;
    return na - nb;
  });
}

let count = 0;
for (const [assetDir, folder] of Object.entries(MAP)) {
  const srcDir = join(SRC_BASE, folder, "电商图");
  if (!existsSync(srcDir)) {
    console.error("  MISSING FOLDER:", srcDir);
    process.exitCode = 1;
    continue;
  }
  const files = sortImages(readdirSync(srcDir));
  if (files.length !== 12) {
    console.error(`  EXPECTED 12 FILES, GOT ${files.length}:`, srcDir);
    process.exitCode = 1;
    continue;
  }
  const outDir = join(ROOT, "assets", "products", assetDir);
  mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < 12; i++) {
    const src = join(srcDir, files[i]);
    const key = KEY_ORDER[i];
    const out = join(outDir, `${key}.jpg`);
    await sharp(src)
      .flatten({ background: "#ffffff" })
      .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toFile(out);
    count++;
    console.log("  ", assetDir + "/" + key + ".jpg", "<-", files[i]);
  }
}
console.log(`Done. ${count} images written.`);
