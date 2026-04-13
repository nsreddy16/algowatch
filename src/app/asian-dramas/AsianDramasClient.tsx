"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Drama } from "@/lib/types";
import { DramaCard } from "@/components/DramaCard";
import { CatalogFilters } from "@/components/CatalogFilters";
import { SimilarPanel } from "@/components/SimilarPanel";
import { DramaDetailModal } from "@/components/DramaDetailModal";

const PAGE_SIZE = 24;

/** Value for PostgREST `or()` ilike filters; wraps in double-quotes so `.` and spaces in the query are safe. */
function ilikeQuotedPattern(raw: string) {
  const t = raw.replace(/,/g, " ").trim().slice(0, 200);
  const escaped = t.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

export function AsianDramasClient() {
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [recommendations, setRecommendations] = useState<Drama[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [similarTo, setSimilarTo] = useState<Drama | null>(null);
  const [similarResults, setSimilarResults] = useState<Drama[] | null>(null);
  const [detailDrama, setDetailDrama] = useState<Drama | null>(null);
  const [filters, setFilters] = useState<{
    yearMin?: number;
    yearMax?: number;
    episodesMin?: number;
    episodesMax?: number;
    ratingMin?: number;
    mediaTypes: string[];
    genres: string[];
    tags: string[];
  }>({
    mediaTypes: [],
    genres: [],
    tags: [],
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const fetchDramas = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("dramas")
      .select("id,title,original_title,media_type,year,num_episodes,rating,description,image_url,link,genres,tags,main_actors,umap_x,umap_y", { count: "exact" });

    const term = search.trim();
    if (term) {
      const pattern = ilikeQuotedPattern(term);
      q = q.or(
        `title.ilike.${pattern},original_title.ilike.${pattern},actors_flat.ilike.${pattern}`
      );
    }

    if (filters.yearMin != null) q = q.gte("year", filters.yearMin);
    if (filters.yearMax != null) q = q.lte("year", filters.yearMax);
    if (filters.episodesMin != null) q = q.gte("num_episodes", filters.episodesMin);
    if (filters.episodesMax != null) q = q.lte("num_episodes", filters.episodesMax);
    if (filters.ratingMin != null) q = q.gte("rating", filters.ratingMin);
    if (filters.mediaTypes.length) q = q.in("media_type", filters.mediaTypes);
    if (filters.genres.length) q = q.overlaps("genres", filters.genres);
    if (filters.tags.length) q = q.overlaps("tags", filters.tags);

    q = q.order("rating", { ascending: false, nullsFirst: false });
    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error(error);
      setDramas([]);
      setTotal(0);
      setError(error.message);
    } else {
      setDramas((data as Drama[]) ?? []);
      setTotal(count ?? 0);
      setError(null);
    }
    setLoading(false);
  }, [page, filters, search, supabase]);

  useEffect(() => {
    fetchDramas();
  }, [fetchDramas]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
  }, [supabase.auth]);

  useEffect(() => {
    if (!user) {
      setRecommendations([]);
      return;
    }
    setRecsLoading(true);
    fetch("/api/recommendations/user")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRecommendations(Array.isArray(data) ? data : []))
      .catch(() => setRecommendations([]))
      .finally(() => setRecsLoading(false));
  }, [user]);

  const findSimilar = useCallback(
    async (drama: Drama) => {
      setSimilarTo(drama);
      setSimilarResults(null);
      const { data, error } = await supabase.rpc("get_similar_dramas", {
        p_target_drama_id: drama.id,
        p_limit: 20,
      });
      if (error) {
        console.error(error);
        setSimilarResults([]);
      } else {
        setSimilarResults((data as Drama[]) ?? []);
      }
    },
    [supabase]
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="flex flex-col xl:flex-row gap-8 xl:items-stretch">
        <aside className="w-full xl:w-56 shrink-0 flex flex-col gap-3 xl:self-start">
          <div className="glass rounded-xl p-4">
            <label htmlFor="drama-search" className="block text-sm text-slate-400 mb-1.5">
              Search
            </label>
            <input
              id="drama-search"
              type="search"
              placeholder="Title or actor…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
            />
          </div>
          <CatalogFilters
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters({ mediaTypes: [], genres: [], tags: [] })}
          />
        </aside>
        <div className="flex-1 min-w-0 w-full min-h-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Asian Dramas</h1>
            <Link
              href="/asian-dramas/explore"
              className="px-4 py-2 rounded-lg glass text-slate-200 text-sm font-medium hover:bg-slate-700/50"
            >
              Explore map
            </Link>
          </div>
          {user && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">Recommended for you</h2>
              {recsLoading ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-40 shrink-0 h-56 rounded-xl glass animate-pulse" />
                  ))}
                </div>
              ) : recommendations.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {recommendations.slice(0, 12).map((d) => (
                    <div key={d.id} className="w-40 shrink-0">
                      <DramaCard
                        drama={d}
                        onOpenDetail={setDetailDrama}
                        onFindSimilar={findSimilar}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">
                  Rank dramas you’ve watched on My rankings to get personalized recommendations.
                </p>
              )}
            </section>
          )}
          {error && (
            <div className="rounded-xl glass p-4 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-80 rounded-xl glass animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {dramas.map((d) => (
                  <DramaCard
                    key={d.id}
                    drama={d}
                    onOpenDetail={setDetailDrama}
                    onFindSimilar={findSimilar}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 rounded-lg glass disabled:opacity-50 text-slate-300"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-slate-400">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 rounded-lg glass disabled:opacity-50 text-slate-300"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {similarTo && (
          <aside className="w-full xl:w-80 shrink-0 xl:max-w-[20rem] min-h-0">
            <div className="xl:sticky xl:top-24 w-full">
              <SimilarPanel
                drama={similarTo}
                results={similarResults ?? []}
                onOpenDetail={setDetailDrama}
                onClose={() => {
                  setSimilarTo(null);
                  setSimilarResults(null);
                }}
              />
            </div>
          </aside>
        )}
      </div>
      {detailDrama && (
        <DramaDetailModal drama={detailDrama} onClose={() => setDetailDrama(null)} />
      )}
    </>
  );
}
