"use client";

import Image from "next/image";
import type { Drama } from "@/lib/types";

type Props = {
  drama: Drama;
  onOpenDetail: (drama: Drama) => void;
  onFindSimilar: (drama: Drama) => void;
};

export function DramaCard({ drama, onOpenDetail, onFindSimilar }: Props) {
  return (
    <div
      data-drama-card
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(drama)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(drama);
        }
      }}
      className="group rounded-xl glass overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all cursor-pointer text-left"
    >
      <div className="aspect-[2/3] bg-slate-800 relative">
        {drama.image_url ? (
          <Image
            src={drama.image_url}
            alt={drama.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            No image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFindSimilar(drama);
            }}
            className="px-2 py-1 rounded text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Find similar
          </button>
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/80 text-amber-400 text-sm font-medium">
          {drama.rating ?? "—"}
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-white truncate" title={drama.title}>
          {drama.title}
        </h3>
        <p className="text-slate-400 text-sm">
          {drama.year ?? "—"} · {drama.num_episodes ?? "—"} eps · {drama.media_type}
        </p>
        {drama.genres?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {drama.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-300"
              >
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
