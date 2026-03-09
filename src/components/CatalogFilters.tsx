"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FilterState = {
  yearMin?: number;
  yearMax?: number;
  episodesMin?: number;
  episodesMax?: number;
  ratingMin?: number;
  mediaTypes: string[];
  genres: string[];
  tags: string[];
};

type Props = {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
};

export function CatalogFilters({ filters, onChange, onReset }: Props) {
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const [mtRes, gRes, tRes] = await Promise.all([
        supabase.from("dramas").select("media_type").limit(5000),
        supabase.from("dramas").select("genres").limit(5000),
        supabase.from("dramas").select("tags").limit(5000),
      ]);
      const mtSet = new Set<string>();
      (mtRes.data ?? []).forEach((r: { media_type: string }) => mtSet.add(r.media_type));
      setMediaTypes(Array.from(mtSet).sort());

      const gSet = new Set<string>();
      (gRes.data ?? []).forEach((r: { genres: string[] }) => (r.genres ?? []).forEach((x) => gSet.add(x)));
      setGenres(Array.from(gSet).sort());

      const tSet = new Set<string>();
      (tRes.data ?? []).forEach((r: { tags: string[] }) => (r.tags ?? []).forEach((x) => tSet.add(x)));
      setTags(Array.from(tSet).sort());
    })();
  }, [supabase]);

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      <h2 className="font-semibold text-white">Filters</h2>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Year</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.yearMin ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                yearMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-white text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.yearMax ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                yearMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-white text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Episodes</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.episodesMin ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                episodesMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-white text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.episodesMax ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                episodesMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-white text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Min rating</label>
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          placeholder="0"
          value={filters.ratingMin ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              ratingMin: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Media type</label>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {mediaTypes.map((m) => (
            <button
              key={m}
              onClick={() =>
                onChange({
                  ...filters,
                  mediaTypes: filters.mediaTypes.includes(m)
                    ? filters.mediaTypes.filter((x) => x !== m)
                    : [...filters.mediaTypes, m],
                })
              }
              className={`px-2 py-1 rounded text-xs ${
                filters.mediaTypes.includes(m)
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Genres</label>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {genres.slice(0, 30).map((g) => (
            <button
              key={g}
              onClick={() =>
                onChange({
                  ...filters,
                  genres: filters.genres.includes(g)
                    ? filters.genres.filter((x) => x !== g)
                    : [...filters.genres, g],
                })
              }
              className={`px-2 py-1 rounded text-xs ${
                filters.genres.includes(g)
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onReset}
        className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700/50"
      >
        Reset filters
      </button>
    </div>
  );
}
