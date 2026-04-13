import { createClient } from "@/lib/supabase/server";
import { unstable_noStore } from "next/cache";
import { UmapExplorer } from "./UmapExplorer";
import Link from "next/link";

export default async function ExplorePage() {
  unstable_noStore();
  let points: { id: number; title: string; rating: number | null; media_type: string; umap_x: number; umap_y: number }[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("dramas")
      .select("id, title, rating, media_type, umap_x, umap_y")
      .not("umap_x", "is", null)
      .not("umap_y", "is", null);
    points = data ?? [];
  } catch {
    // Supabase not configured or unreachable
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-white">Explore by taste</h1>
        <Link
          href="/asian-dramas"
          className="px-4 py-2 rounded-lg glass text-slate-200 text-sm font-medium hover:bg-slate-700/50"
        >
          Find dramas
        </Link>
      </div>
      <p className="text-slate-400 mb-6">
        Each point is a drama in 2D UMAP space (colors follow media type, e.g. Korean vs Chinese). Your position is a
        rank-weighted blend of titles on My rankings. Arrows point toward suggested next watches. This algorithm and display is still a work in progress.
      </p>
      <UmapExplorer initialPoints={points} />
    </div>
  );
}
