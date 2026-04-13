#!/usr/bin/env python3
"""
Deprecated: use `npm run ingest` (scripts/ingest-all.mjs) for a single Node-based workflow.

This file is kept for reference or environments that cannot run Node; behavior matches
ingest-all.mjs (JSON + optional .npy files).
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_env():
    for name in (".env", ".env.local"):
        path = PROJECT_ROOT / name
        if not path.exists():
            continue
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    key, value = key.strip(), value.strip().strip("'\"").strip()
                    if key and not os.environ.get(key):
                        os.environ[key] = value


def parse_num(val):
    if val is None:
        return None
    try:
        n = float(val)
        return n if np.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def parse_rating(val):
    n = parse_num(val)
    if n is None:
        return None
    return min(10.0, max(0.0, round(n * 10) / 10))


def main():
    load_env()

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local", file=sys.stderr)
        sys.exit(1)

    url = url.rstrip("/")
    api = f"{url}/rest/v1"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    json_path = PROJECT_ROOT / "mydramalist_kdramas_v2.json"
    emb_path = PROJECT_ROOT / "drama_embeddings.npy"
    umap_path = PROJECT_ROOT / "drama_embeddings_2d.npy"

    # DB column must match; set EMBED_DIM in .env if your .npy uses a different dimension.
    EMBED_DIM = int(os.environ.get("EMBED_DIM", "384"))

    if not json_path.exists():
        print(f"Not found: {json_path}", file=sys.stderr)
        sys.exit(1)

    print("Loading", json_path)
    with open(json_path) as f:
        items = json.load(f)
    if not isinstance(items, list):
        print("JSON root must be an array", file=sys.stderr)
        sys.exit(1)

    embeddings = None
    if emb_path.exists():
        print("Loading", emb_path)
        embeddings = np.load(emb_path)
        if embeddings.ndim != 2:
            print(f"Expected 2D array, got shape {embeddings.shape}", file=sys.stderr)
            sys.exit(1)
        if embeddings.shape[1] != EMBED_DIM:
            print(f"Embedding dim is {embeddings.shape[1]}; DB expects {EMBED_DIM}. Alter dramas.embedding or set EMBED_DIM.", file=sys.stderr)
            sys.exit(1)
        if len(embeddings) != len(items):
            print(f"Length mismatch: embeddings {len(embeddings)} vs JSON {len(items)}", file=sys.stderr)
            sys.exit(1)
    else:
        print("No drama_embeddings.npy; embedding column will be null")

    umap_2d = None
    if umap_path.exists():
        print("Loading", umap_path)
        umap_2d = np.load(umap_path)
        if umap_2d.ndim != 2 or umap_2d.shape[1] != 2:
            print(f"Expected Nx2 array, got shape {umap_2d.shape}", file=sys.stderr)
            sys.exit(1)
        if len(umap_2d) != len(items):
            print(f"Length mismatch: umap {len(umap_2d)} vs JSON {len(items)}", file=sys.stderr)
            sys.exit(1)
    else:
        print("No drama_embeddings_2d.npy; umap_x/umap_y will be null")

    batch_size = 100
    inserted = 0

    for start in range(0, len(items), batch_size):
        batch_items = items[start : start + batch_size]
        rows = []
        for i, item in enumerate(batch_items):
            idx = start + i
            year = parse_num(item.get("year"))
            num_episodes = parse_num(item.get("episodes"))
            rating = parse_rating(item.get("rating"))

            row = {
                "title": item.get("title") or "",
                "original_title": item.get("original_title"),
                "media_type": item.get("media_type") or "Korean Drama",
                "year": int(year) if year is not None else None,
                "num_episodes": int(num_episodes) if num_episodes is not None else None,
                "rating": rating,
                "description": item.get("description"),
                "image_url": item.get("image_url"),
                "link": item.get("link"),
                "genres": item.get("genres") if isinstance(item.get("genres"), list) else [],
                "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
                "main_actors": item.get("main_actors") if isinstance(item.get("main_actors"), list) else [],
            }

            if embeddings is not None:
                # PostgREST/pgvector expects vector as string "[x,y,z,...]"
                row["embedding"] = "[" + ",".join(str(float(x)) for x in embeddings[idx]) + "]"
            if umap_2d is not None:
                row["umap_x"] = float(umap_2d[idx, 0])
                row["umap_y"] = float(umap_2d[idx, 1])

            rows.append(row)

        r = requests.post(f"{api}/dramas", json=rows, headers=headers, timeout=60)
        if not r.ok:
            print(f"Batch error at {start}: {r.status_code} {r.text}", file=sys.stderr)
            sys.exit(1)
        inserted += len(rows)
        print(f"Inserted {inserted} / {len(items)}")

    print("Done. Total inserted:", inserted)


if __name__ == "__main__":
    main()
