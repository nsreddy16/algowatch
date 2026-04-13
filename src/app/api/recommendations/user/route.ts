import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam == null ? NaN : Number(limitParam);
  const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, Math.floor(parsedLimit))) : 30;
  const { data, error } = await supabase.rpc("get_user_recommendations", {
    p_limit: limit,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
