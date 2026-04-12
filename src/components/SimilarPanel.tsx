"use client";

import Image from "next/image";
import type { Drama } from "@/lib/types";

type Props = {
  drama: Drama;
  results: Drama[];
  onClose: () => void;
};

export function SimilarPanel({ drama, results, onClose }: Props) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col border border-slate-600/60 shadow-xl max-h-[min(32rem,calc(100vh-6rem))]">
      <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
        <h3 className="font-semibold text-white text-sm leading-snug">
          Similar to &quot;{drama.title}&quot;
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded shrink-0 text-slate-400 hover:bg-slate-700 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {results.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No similar dramas found. Add embeddings to the catalog to enable similarity search.
          </p>
        ) : (
          results.map((d) => (
            <div key={d.id} className="flex gap-3">
              <div className="relative w-16 shrink-0 aspect-[2/3] rounded bg-slate-800 overflow-hidden">
                {d.image_url ? (
                  <Image
                    src={d.image_url}
                    alt={d.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">—</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{d.title}</p>
                <p className="text-slate-400 text-xs">
                  {d.year} · {d.rating ?? "—"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
