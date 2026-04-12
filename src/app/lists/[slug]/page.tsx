import { createClient } from "@/lib/supabase/server";
import { unstable_noStore } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { ListDetailClient } from "./ListDetailClient";

type ListItemWithDrama = {
  id: string;
  list_id: string;
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

type Props = { params: Promise<{ slug: string }> };

export default async function ListDetailPage({ params }: Props) {
  unstable_noStore();
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let list = await supabase
      .from("lists")
      .select("*")
      .eq("share_slug", slug)
      .single();

    if (!list.data) {
      list = await supabase.from("lists").select("*").eq("id", slug).single();
    }

    if (!list.data) notFound();

    const isOwner = user?.id === list.data.user_id;

    if (!list.data.is_public && !isOwner) redirect("/auth/login");

    const { data: rawItems } = await supabase
      .from("list_items")
      .select(`
        id, list_id, drama_id, rank, notes,
        drama:dramas(id, title, year, num_episodes, rating, image_url, genres, media_type)
      `)
      .eq("list_id", list.data.id)
      .order("rank", { ascending: true });

    const items: ListItemWithDrama[] = (rawItems ?? []).map((row: { drama?: unknown[] | unknown }) => {
      const drama = Array.isArray(row.drama) ? row.drama[0] : row.drama;
      return { ...row, drama } as ListItemWithDrama;
    });

    return (
      <ListDetailClient
        list={list.data}
        items={items}
        isOwner={!!isOwner}
      />
    );
  } catch {
    notFound();
  }
}
