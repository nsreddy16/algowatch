import { createClient } from "@/lib/supabase/server";
import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { ListsClient } from "./ListsClient";

export default async function ListsPage() {
  unstable_noStore();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: lists } = await supabase
      .from("lists")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ListsClient initialLists={lists ?? []} />
      </div>
    );
  } catch {
    redirect("/auth/login");
  }
}
