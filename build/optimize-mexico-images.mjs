/*
 * One-off: turn the Meitu DesignKit master images for the four Mexico-collection
 * cases into web-optimised JPEGs under assets/products/<dir>/.
 *
 * Source masters live outside this repo (the design working folder) and are not
 * committed; only the resized web copies are. Re-run only if a master changes.
 *
 * Run: node build/optimize-mexico-images.mjs
 */
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_BASE = "J:/Claude/Claude-Trading/产品设计/可降解镭雕图案";
const MAX = 1400;
const QUALITY = 80;

const MAP = {
  "aztec-geometry": {
    folder: "阿兹特克几何（Aztec Geometry）成品/电商图",
    files: {
      main: "aztec_main_1_front_cleanbg.jpg",
      texture: "aztec_main_2_texture_macro.jpg",
      "scene-culture": "aztec_main_3_mesoamerican_scene.jpg",
      "scene-eco": "aztec_main_4_eco_scene.jpg",
      colors: "aztec_main_5_dualcolor_lineup.jpg",
      hold: "aztec_main_6_hand_hold.jpg",
      meaning: "aztec_detail_1_pattern_meaning.jpg",
      material: "aztec_detail_2_material_eco.jpg",
      embossed: "aztec_detail_3_embossed_macro.jpg",
      protection: "aztec_detail_4_precise_protection.jpg",
      lifestyle: "aztec_detail_5_lifestyle_desk.png",
      sizes: "aztec_detail_6_size_fit_v2.jpg"
    }
  },
  "alebrijes-art": {
    folder: "阿布里赫传统怪兽（Alebrijes Art）成品/电商图",
    files: {
      main: "alebrijes_main_1_front_cleanbg.jpg",
      texture: "alebrijes_main_2_relief_macro.jpg",
      "scene-culture": "alebrijes_main_3_mexican_folkart.jpg",
      "scene-eco": "alebrijes_main_4_eco_scene.jpg",
      colors: "alebrijes_main_5_dualcolor_lineup.jpg",
      hold: "alebrijes_main_6_hand_hold.jpg",
      meaning: "alebrijes_detail_1_pattern_meaning.jpg",
      material: "alebrijes_detail_2_material_eco.jpg",
      embossed: "alebrijes_detail_3_embossed_macro.jpg",
      protection: "alebrijes_detail_4_precise_protection.jpg",
      lifestyle: "alebrijes_detail_5_lifestyle_desk.jpg",
      sizes: "alebrijes_detail_6_size_fit_v2.jpg"
    }
  },
  "floral-embroidery": {
    folder: "刺绣花卉（Floral Embroidery）成品/电商图",
    files: {
      main: "floral_main_1_front_cleanbg.jpg",
      texture: "floral_main_2_relief_macro.jpg",
      "scene-culture": "floral_main_3_embroidery_scene.jpg",
      "scene-eco": "floral_main_4_eco_scene.jpg",
      colors: "floral_main_5_dualcolor_lineup.jpg",
      hold: "floral_main_6_hand_hold.jpg",
      meaning: "floral_detail_1_pattern_meaning_v3.jpg",
      material: "floral_detail_2_material_eco.jpg",
      embossed: "floral_detail_3_embossed_macro.jpg",
      protection: "floral_detail_4_precise_protection.jpg",
      lifestyle: "floral_detail_5_lifestyle_desk.jpg",
      sizes: "floral_detail_6_size_fit.jpg"
    }
  },
  "mayan-glyphs": {
    folder: "玛雅纹饰（Mayan Glyphs） 成品/电商图",
    files: {
      main: "mayan_main_1_front_cleanbg.jpg",
      texture: "mayan_main_2_relief_macro.jpg",
      "scene-culture": "mayan_main_3_temple_scene.jpg",
      "scene-eco": "mayan_main_4_eco_scene.jpg",
      colors: "mayan_main_5_dualcolor_lineup.jpg",
      hold: "mayan_main_6_hand_hold.jpg",
      meaning: "mayan_detail_1_pattern_meaning.jpg",
      material: "mayan_detail_2_material_eco.jpg",
      embossed: "mayan_detail_3_embossed_macro.jpg",
      protection: "mayan_detail_4_precise_protection_v2.jpg",
      lifestyle: "mayan_detail_5_lifestyle_desk.jpg",
      sizes: "mayan_detail_6_size_fit.jpg"
    }
  }
};

let count = 0;
for (const [dir, cfg] of Object.entries(MAP)) {
  const outDir = join(ROOT, "assets", "products", dir);
  mkdirSync(outDir, { recursive: true });
  for (const [key, fname] of Object.entries(cfg.files)) {
    const src = join(SRC_BASE, cfg.folder, fname);
    if (!existsSync(src)) {
      console.error("  MISSING:", src);
      process.exitCode = 1;
      continue;
    }
    const out = join(outDir, `${key}.jpg`);
    await sharp(src)
      .flatten({ background: "#ffffff" })
      .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toFile(out);
    count++;
    console.log("  ", dir + "/" + key + ".jpg");
  }
}
console.log(`Done. ${count} images written.`);
