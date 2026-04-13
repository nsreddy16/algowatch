"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Drama } from "@/lib/types";
import { ASIAN_CATALOG } from "@/lib/catalog";
import {
  mediaTypeRegion,
  regionColor,
  orderedRegionsPresent,
} from "@/lib/mediaTypeRegion";
import { DramaDetailModal } from "@/components/DramaDetailModal";

type DramaPoint = {
  id: number;
  title: string;
  rating: number | null;
  media_type: string;
  umap_x: number;
  umap_y: number;
};

type Props = { initialPoints: DramaPoint[] };

const REC_ARROW_LIMIT = 8;

export function UmapExplorer({ initialPoints }: Props) {
  const [userPoint, setUserPoint] = useState<{ x: number; y: number } | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [recs, setRecs] = useState<Drama[]>([]);
  const [showArrows, setShowArrows] = useState(true);
  const [detailDrama, setDetailDrama] = useState<Drama | null>(null);
  const supabase = createClient();

  async function openDramaDetail(dramaId: number) {
    const { data } = await supabase
      .from("dramas")
      .select(
        "id,title,original_title,media_type,year,num_episodes,rating,description,image_url,link,genres,tags,main_actors,umap_x,umap_y"
      )
      .eq("id", dramaId)
      .maybeSingle();
    if (data) {
      setDetailDrama(data as Drama);
    }
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [posResp, rankedResp] = await Promise.all([
        supabase.rpc("get_user_umap_position"),
        supabase
          .from("user_ranked_dramas")
          .select("drama_id")
          .eq("user_id", user.id)
          .eq("catalog", ASIAN_CATALOG),
      ]);

      const pos = posResp.data;
      if (pos?.[0] && pos[0].umap_x != null && pos[0].umap_y != null) {
        setUserPoint({
          x: Number(pos[0].umap_x) ?? 0,
          y: Number(pos[0].umap_y) ?? 0,
        });
      }

      setHighlightIds(new Set((rankedResp.data ?? []).map((r) => r.drama_id)));
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const recResp = await fetch(`/api/recommendations/user?limit=${REC_ARROW_LIMIT}`).catch(() => null);
      if (recResp?.ok) {
        const data = await recResp.json();
        setRecs(Array.isArray(data) ? data : []);
      } else {
        setRecs([]);
      }
    })();
  }, []);

  const points = useMemo(
    () => initialPoints.filter((p) => p.umap_x != null && p.umap_y != null),
    [initialPoints]
  );

  const regionsInUse = useMemo(() => {
    const s = new Set<string>();
    for (const p of points) {
      s.add(mediaTypeRegion(p.media_type));
    }
    return orderedRegionsPresent(s);
  }, [points]);

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

  const recArrows = useMemo(() => {
    if (!userPoint || !showArrows) return [];
    const ux = scaleX(userPoint.x);
    const uy = scaleY(userPoint.y);
    return recs
      .filter((d) => d.umap_x != null && d.umap_y != null)
      .map((d) => ({
        id: d.id,
        title: d.title,
        x2: scaleX(d.umap_x!),
        y2: scaleY(d.umap_y!),
        ux,
        uy,
      }));
  }, [userPoint, showArrows, recs, minX, maxX, minY, maxY]);

  if (points.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center text-slate-400">
        No UMAP data yet. Add <code className="text-slate-300">umap_x</code> and{" "}
        <code className="text-slate-300">umap_y</code> to your drama records to see the map.
      </div>
    );
  }

  return (
    <>
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showArrows}
            onChange={(e) => setShowArrows(e.target.checked)}
            className="rounded border-slate-600"
          />
          Show suggestion arrows (taste → recommendations)
        </label>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(239, 68, 68, 0.95)" />
          </marker>
        </defs>
        {recArrows.map((a) => (
          <line
            key={a.id}
            x1={a.ux}
            y1={a.uy}
            x2={a.x2}
            y2={a.y2}
            stroke="rgba(239, 68, 68, 0.75)"
            strokeWidth={1.5}
            markerEnd="url(#arrowhead)"
          />
        ))}
        {points.map((p) => {
          const x = scaleX(p.umap_x);
          const y = scaleY(p.umap_y);
          const isHighlight = highlightIds.has(p.id);
          const isHover = hoverId === p.id;
          const region = mediaTypeRegion(p.media_type);
          const fill = regionColor(region);
          return (
            <g key={p.id}>
              <circle
                cx={x}
                cy={y}
                r={isHover ? 8 : isHighlight ? 6 : 3.5}
                fill={fill}
                fillOpacity={isHighlight ? 1 : 0.75}
                stroke={isHover ? "#fff" : "transparent"}
                strokeWidth={2}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => void openDramaDetail(p.id)}
                className="cursor-pointer"
              />
              {isHover && (
                <text x={x} y={y - 12} textAnchor="middle" fill="#e2e8f0" fontSize={12}>
                  {p.title}
                </text>
              )}
            </g>
          );
        })}
        {userPoint && (
          <g>
            <circle
              cx={scaleX(userPoint.x)}
              cy={scaleY(userPoint.y)}
              r={10}
              fill="none"
              stroke="#ef4444"
              strokeWidth={3}
            />
            <text
              x={scaleX(userPoint.x)}
              y={scaleY(userPoint.y) - 16}
              textAnchor="middle"
              fill="#ef4444"
              fontSize={11}
            >
              You
            </text>
          </g>
        )}
      </svg>
      <div className="px-4 py-3 border-t border-slate-700 flex flex-col gap-3 text-sm text-slate-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-slate-500 font-medium text-xs uppercase tracking-wide">Region (media type)</span>
          {regionsInUse.map((r) => (
            <span key={r} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: regionColor(r) }} />
              {r}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-white/80 bg-violet-500/40" /> Ranked (larger dot)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Not in rankings
          </span>
          {userPoint && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" /> You (weighted taste)
            </span>
          )}
          {showArrows && recArrows.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-8 h-0.5 bg-red-500 rounded" /> Suggested next
            </span>
          )}
        </div>
      </div>
    </div>
    {detailDrama && <DramaDetailModal drama={detailDrama} onClose={() => setDetailDrama(null)} />}
    </>
  );
}
