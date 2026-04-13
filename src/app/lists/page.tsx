import { createClient } from "@/lib/supabase/server";
import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { RankingsClient } from "./RankingsClient";
import { ASIAN_CATALOG } from "@/lib/catalog";

type RankRow = {
  id: string;
  user_id: string;
  catalog: string;
  drama_id: number;
  rank: number;
  notes: string | null;
  drama: {
    id: number;
    title: string;
    year: number | null;
    num_episodes: number | null;
    rating: number | null;
    image_url: string | null;
    genres: string[] | null;
    media_type: string;
  };
};

export default async function RankingsPage() {
  unstable_noStore();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: rawItems } = await supabase
      .from("user_ranked_dramas")
      .select(
        `
        id, user_id, catalog, drama_id, rank, notes,
        drama:dramas(id, title, year, num_episodes, rating, image_url, genres, media_type)
      `
      )
      .eq("user_id", user.id)
      .eq("catalog", ASIAN_CATALOG)
      .order("rank", { ascending: true });

    const items: RankRow[] = (rawItems ?? []).map((row: { drama?: unknown[] | unknown }) => {
      const drama = Array.isArray(row.drama) ? row.drama[0] : row.drama;
      return { ...row, drama } as RankRow;
    });

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <RankingsClient initialItems={items} />
      </div>
    );
  } catch {
    redirect("/auth/login");
  }
}
