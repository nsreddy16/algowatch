#!/usr/bin/env node
/**
 * Sync poster URLs from mydramalist_kdramas_v2.json into public.dramas (match on link).
 * Requires: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Loads .env and .env.local from project root if present.
 *
 * Uses per-row updates (no SQL migration). Optional: 00003_apply_drama_image_batch.sql + RPC for huge catalogs.
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

/** Concurrent updates per wave (stay under rate limits). */
const CONCURRENCY = 20;

async function updateOne(link, image_url) {
  const { data, error } = await supabase
    .from("dramas")
    .update({ image_url })
    .eq("link", link)
    .select("id");
  if (error) return { ok: false, error };
  return { ok: true, matched: (data?.length ?? 0) > 0 };
}

async function main() {
  const jsonPath = join(projectRoot, "mydramalist_kdramas_v2.json");
  console.log("Reading", jsonPath);
  const raw = readFileSync(jsonPath, "utf8");
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) {
    console.error("JSON root must be an array");
    process.exit(1);
  }

  const pairs = [];
  for (const item of items) {
    const link = item?.link;
    const image_url = item?.image_url;
    if (typeof link !== "string" || !link.trim()) continue;
    if (typeof image_url !== "string" || !image_url.trim()) continue;
    pairs.push({ link: link.trim(), image_url: image_url.trim() });
  }

  console.log("Rows with link + image_url:", pairs.length);

  let matched = 0;
  let unmatched = 0;
  let wave = 0;

  for (let i = 0; i < pairs.length; i += CONCURRENCY) {
    const slice = pairs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((p) => updateOne(p.link, p.image_url)));
    for (const r of results) {
      if (!r.ok) {
        console.error("Update error:", r.error);
        throw r.error;
      }
      if (r.matched) matched++;
      else unmatched++;
    }
    wave++;
    const done = Math.min(i + CONCURRENCY, pairs.length);
    if (wave % 5 === 0 || done === pairs.length) {
      console.log("Progress:", done, "/", pairs.length, "| matched so far:", matched);
    }
  }

  console.log("Done. Rows updated (matched a drama by link):", matched);
  if (unmatched > 0) {
    console.log("No matching row in DB for", unmatched, "JSON entries (check link strings vs imported data).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
