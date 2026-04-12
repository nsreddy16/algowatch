"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { Drama } from "@/lib/types";

type Props = {
  drama: Drama;
  onClose: () => void;
};

export function DramaDetailModal({ drama, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drama-detail-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl glass border border-slate-600/80 shadow-2xl shadow-indigo-950/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800"
          aria-label="Close"
        >
          ×
        </button>
        <div className="relative aspect-[16/10] w-full bg-slate-900">
          {drama.image_url ? (
            <Image
              src={drama.image_url}
              alt={drama.title}
              fill
              className="object-cover"
              sizes="(max-width: 512px) 100vw, 512px"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              No poster
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 id="drama-detail-title" className="text-xl font-bold text-white drop-shadow-md">
              {drama.title}
            </h2>
            {drama.original_title && drama.original_title !== drama.title && (
              <p className="text-slate-300 text-sm mt-1">{drama.original_title}</p>
            )}
            <p className="text-slate-400 text-sm mt-2">
              {drama.year ?? "—"} · {drama.num_episodes ?? "—"} eps · {drama.media_type} ·{" "}
              <span className="text-amber-400 font-medium">{drama.rating ?? "—"}</span>
            </p>
          </div>
        </div>
        <div className="p-5 space-y-5 text-slate-200">
          {drama.main_actors?.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                Cast
              </h3>
              <div className="flex flex-wrap gap-2">
                {drama.main_actors.map((a) => (
                  <span
                    key={a}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 text-sm text-slate-200 border border-slate-600/60"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}
          {drama.description && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                Synopsis
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {drama.description}
              </p>
            </section>
          )}
          {drama.tags?.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {drama.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md text-xs bg-slate-800 text-slate-400 border border-slate-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}
          {drama.genres?.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                Genres
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {drama.genres.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-md text-xs bg-indigo-950/80 text-indigo-200">
                    {g}
                  </span>
                ))}
              </div>
            </section>
          )}
          {drama.link && (
            <a
              href={drama.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              Open on MyDramaList →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
