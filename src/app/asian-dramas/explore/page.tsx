import { createClient } from "@/lib/supabase/server";
import { UmapExplorer } from "./UmapExplorer";

export default async function ExplorePage() {
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
      <h1 className="text-2xl font-bold text-white mb-2">Explore by taste</h1>
      <p className="text-slate-400 mb-6">
        Each point is a drama in 2D UMAP space. Your position is the average of your list.
      </p>
      <UmapExplorer initialPoints={points} />
    </div>
  );
}
