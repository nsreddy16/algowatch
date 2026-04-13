#!/usr/bin/env node
/**
 * Single entry: mydramalist_kdramas_v2.json → Supabase public.dramas
 * Optionally attaches drama_embeddings.npy + drama_embeddings_2d.npy when present (same row order as JSON).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY in .env / .env.local
 * Optional: EMBED_DIM (default 384) must match DB vector dimension and .npy width
 *
 * Run: npm run ingest
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { load as loadNpy } from "npyjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

/** npyjs `load(string)` uses fetch() (URLs only). In Node, read bytes and pass an ArrayBuffer. */
async function loadNpyFromPath(filePath) {
  const buf = readFileSync(filePath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return loadNpy(ab);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(projectRoot, ".env"));
loadEnvFile(join(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMBED_DIM = Number(process.env.EMBED_DIM ?? "384") || 384;

function parseNum(val) {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseRating(val) {
  const n = parseNum(val);
  if (n == null) return null;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

function toVectorFromArray(arr) {
  if (arr == null || !Array.isArray(arr) || arr.length === 0) return null;
  return `[${arr.join(",")}]`;
}

function toVectorFromFlat(data, rowIndex, dim) {
  const off = rowIndex * dim;
  const slice = data.subarray(off, off + dim);
  return `[${Array.from(slice, (x) => Number(x)).join(",")}]`;
}

function mapRow(item, opts) {
  const { embeddingStr, umapX, umapY } = opts;
  const year = parseNum(item.year);
  const num_episodes = parseNum(item.episodes);
  const rating = parseRating(item.rating);
  return {
    title: item.title ?? "",
    original_title: item.original_title ?? null,
    media_type: item.media_type ?? "Korean Drama",
    year: year ?? null,
    num_episodes: num_episodes ?? null,
    rating: rating ?? null,
    description: item.description ?? null,
    image_url: item.image_url ?? null,
    link: item.link ?? null,
    genres: Array.isArray(item.genres) ? item.genres : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    main_actors: Array.isArray(item.main_actors) ? item.main_actors : [],
    embedding: embeddingStr,
    umap_x: umapX ?? parseNum(item.umap_x) ?? null,
    umap_y: umapY ?? parseNum(item.umap_y) ?? null,
  };
}

const BATCH_SIZE = 100;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL) in .env / .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const jsonPath = join(projectRoot, "mydramalist_kdramas_v2.json");
  const embPath = join(projectRoot, "drama_embeddings.npy");
  const umapPath = join(projectRoot, "drama_embeddings_2d.npy");

  if (!existsSync(jsonPath)) {
    console.error("Missing:", jsonPath);
    process.exit(1);
  }

  console.log("Reading", jsonPath);
  const items = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(items)) {
    console.error("JSON root must be an array");
    process.exit(1);
  }

  const n = items.length;

  let embNpy = null;
  if (existsSync(embPath)) {
    console.log("Reading", embPath);
    embNpy = await loadNpyFromPath(embPath);
    const [rows, dim] = embNpy.shape;
    if (embNpy.shape.length !== 2) {
      console.error("drama_embeddings.npy must be 2D, got shape", embNpy.shape);
      process.exit(1);
    }
    if (dim !== EMBED_DIM) {
      console.error(
        `Embedding width is ${dim}; DB expects ${EMBED_DIM}. Set EMBED_DIM in .env or alter dramas.embedding.`
      );
      process.exit(1);
    }
    if (rows !== n) {
      console.error(`Row count mismatch: embeddings ${rows} vs JSON ${n}`);
      process.exit(1);
    }
  } else {
    console.log("No drama_embeddings.npy — embedding column will be null unless set in JSON rows");
  }

  let umapNpy = null;
  if (existsSync(umapPath)) {
    console.log("Reading", umapPath);
    umapNpy = await loadNpyFromPath(umapPath);
    if (umapNpy.shape.length !== 2 || umapNpy.shape[1] !== 2) {
      console.error("drama_embeddings_2d.npy must be Nx2, got shape", umapNpy.shape);
      process.exit(1);
    }
    if (umapNpy.shape[0] !== n) {
      console.error(`Row count mismatch: UMAP ${umapNpy.shape[0]} vs JSON ${n}`);
      process.exit(1);
    }
  } else {
    console.log("No drama_embeddings_2d.npy — umap_x / umap_y will be null unless set in JSON rows");
  }

  const rows = [];
  for (let i = 0; i < n; i++) {
    const item = items[i];
    let embeddingStr = toVectorFromArray(item.embedding);
    let umapX = parseNum(item.umap_x);
    let umapY = parseNum(item.umap_y);

    if (embNpy) {
      embeddingStr = toVectorFromFlat(embNpy.data, i, EMBED_DIM);
    }
    if (umapNpy) {
      umapX = Number(umapNpy.data[i * 2]);
      umapY = Number(umapNpy.data[i * 2 + 1]);
    }

    rows.push(
      mapRow(item, {
        embeddingStr,
        umapX,
        umapY,
      })
    );
  }

  console.log("Inserting", rows.length, "rows in batches of", BATCH_SIZE);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from("dramas").insert(batch).select("id");
    if (error) {
      console.error("Batch error at offset", i, error);
      process.exit(1);
    }
    inserted += data?.length ?? 0;
    console.log("Inserted", inserted, "/", rows.length);
  }

  console.log("\nDone. Total inserted:", inserted);
  if (embNpy) {
    console.log(
      "\nEmbeddings loaded. If this was a fresh DB, migrations should already include 00002 (IVFFLAT). After large loads, run in SQL Editor:\n  analyze public.dramas;\n"
    );
  } else {
    console.log(
      "\nTip: add drama_embeddings.npy + drama_embeddings_2d.npy next to the JSON (same order) and re-run for vectors + map."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
