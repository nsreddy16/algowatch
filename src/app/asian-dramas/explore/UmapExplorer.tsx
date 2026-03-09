"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type DramaPoint = {
  id: number;
  title: string;
  rating: number | null;
  media_type: string;
  umap_x: number;
  umap_y: number;
};

type Props = { initialPoints: DramaPoint[] };

export function UmapExplorer({ initialPoints }: Props) {
  const [userPoint, setUserPoint] = useState<{ x: number; y: number } | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  const [hoverId, setHoverId] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: pos } = await supabase.rpc("get_user_umap_position");
      if (pos?.[0]) {
        setUserPoint({ x: Number(pos[0].umap_x) ?? 0, y: Number(pos[0].umap_y) ?? 0 });
      }
      const { data: lists } = await supabase.from("lists").select("id").eq("user_id", user.id);
      const listIds = (lists ?? []).map((l) => l.id);
      if (listIds.length === 0) return;
      const { data: items } = await supabase.from("list_items").select("drama_id").in("list_id", listIds);
      setHighlightIds(new Set((items ?? []).map((i) => i.drama_id)));
    })();
  }, [supabase]);

  const points = useMemo(() => initialPoints.filter((p) => p.umap_x != null && p.umap_y != null), [initialPoints]);
  const xs = points.map((p) => p.umap_x);
  const ys = points.map((p) => p.umap_y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 40;
  const width = 900;
  const height = 600;

  function scaleX(x: number) {
    return padding + ((x - minX) / (maxX - minX || 1)) * (width - 2 * padding);
  }
  function scaleY(y: number) {
    return height - padding - ((y - minY) / (maxY - minY || 1)) * (height - 2 * padding);
  }

  if (points.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center text-slate-400">
        No UMAP data yet. Add <code className="text-slate-300">umap_x</code> and <code className="text-slate-300">umap_y</code> to your drama records to see the map.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
        {points.map((p) => {
          const x = scaleX(p.umap_x);
          const y = scaleY(p.umap_y);
          const isHighlight = highlightIds.has(p.id);
          const isHover = hoverId === p.id;
          return (
            <Link key={p.id} href={`/asian-dramas?drama=${p.id}`}>
              <circle
                cx={x}
                cy={y}
                r={isHover ? 8 : isHighlight ? 5 : 3}
                fill={isHighlight ? "#818cf8" : "rgba(148,163,184,0.6)"}
                stroke={isHover ? "#fff" : "transparent"}
                strokeWidth={2}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
              />
              {isHover && (
                <text x={x} y={y - 12} textAnchor="middle" fill="#e2e8f0" fontSize={12}>
                  {p.title}
                </text>
              )}
            </Link>
          );
        })}
        {userPoint && (
          <g>
            <circle
              cx={scaleX(userPoint.x)}
              cy={scaleY(userPoint.y)}
              r={10}
              fill="none"
              stroke="#22c55e"
              strokeWidth={3}
            />
            <text x={scaleX(userPoint.x)} y={scaleY(userPoint.y) - 16} textAnchor="middle" fill="#22c55e" fontSize={11}>
              You
            </text>
          </g>
        )}
      </svg>
      <div className="px-4 py-2 border-t border-slate-700 flex items-center gap-4 text-sm text-slate-400">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-indigo-500" /> Your list
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-400" /> Catalog
        </span>
        {userPoint && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-transparent" /> You
          </span>
        )}
      </div>
    </div>
  );
}
