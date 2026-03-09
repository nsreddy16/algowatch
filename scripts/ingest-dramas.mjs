#!/usr/bin/env node
/**
 * One-time import: mydramalist_kdramas_v2.json -> Supabase public.dramas
 * Requires: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env.
 * Loads .env and .env.local from project root if present.
 * Optional: embedding, umap_x, umap_y on each item (nullable in DB).
 * For embeddings/UMAP from .npy files, use: python scripts/ingest_dramas.py
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(projectRoot, ".env"));
loadEnvFile(join(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

function toVector(arr) {
  if (arr == null) return null;
  if (Array.isArray(arr) && arr.length > 0) return `[${arr.join(",")}]`;
  return null;
}

function mapRow(item) {
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
    embedding: toVector(item.embedding),
    umap_x: parseNum(item.umap_x) ?? null,
    umap_y: parseNum(item.umap_y) ?? null,
  };
}

const BATCH_SIZE = 100;

async function main() {
  const jsonPath = join(projectRoot, "mydramalist_kdramas_v2.json");
  console.log("Reading", jsonPath);
  const raw = readFileSync(jsonPath, "utf8");
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) {
    console.error("JSON root must be an array");
    process.exit(1);
  }

  const rows = items.map(mapRow);
  console.log("Mapped", rows.length, "rows. Inserting in batches of", BATCH_SIZE);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from("dramas").insert(batch).select("id");
    if (error) {
      console.error("Batch error at offset", i, error);
      throw error;
    }
    inserted += (data?.length ?? 0);
    console.log("Inserted", inserted, "/", rows.length);
  }

  console.log("Done. Total inserted:", inserted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
