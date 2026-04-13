"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
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

type Props = { initialItems: RankRow[] };

const RANK_OFFSET = 500_000;

function SortableRow({
  item,
  onRemove,
}: {
  item: RankRow;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 rounded-lg glass ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab touch-none p-1 text-slate-400 hover:text-white"
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </button>
      <div className="relative w-12 h-[4.5rem] shrink-0 rounded bg-slate-800 overflow-hidden">
        {item.drama?.image_url ? (
          <Image
            src={item.drama.image_url}
            alt={item.drama.title}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
            —
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white truncate">{item.drama?.title ?? "—"}</p>
        <p className="text-slate-400 text-sm">
          {item.drama?.year ?? "—"} · {item.drama?.rating ?? "—"} · {item.drama?.media_type}
        </p>
      </div>
      <span className="text-slate-500 text-sm w-8">#{item.rank}</span>
      <button
        type="button"
        onClick={onRemove}
        className="p-2 rounded text-slate-400 hover:bg-red-500/20 hover:text-red-400"
        aria-label="Remove"
      >
        ×
      </button>
    </div>
  );
}

export function RankingsClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const persistRanks = useCallback(
    async (reordered: RankRow[]) => {
      setSaving(true);
      for (let i = 0; i < reordered.length; i++) {
        await supabase
          .from("user_ranked_dramas")
          .update({ rank: RANK_OFFSET + i })
          .eq("id", reordered[i].id);
      }
      for (let i = 0; i < reordered.length; i++) {
        await supabase
          .from("user_ranked_dramas")
          .update({ rank: i + 1 })
          .eq("id", reordered[i].id);
      }
      setSaving(false);
    },
    [supabase]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
        ...it,
        rank: idx + 1,
      }));
      setItems(reordered);
      await persistRanks(reordered);
    },
    [items, persistRanks]
  );

  async function removeItem(id: string) {
    await supabase.from("user_ranked_dramas").delete().eq("id", id);
    const next = items.filter((i) => i.id !== id).map((it, idx) => ({ ...it, rank: idx + 1 }));
    setItems(next);
    await persistRanks(next);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/asian-dramas" className="text-slate-400 hover:text-white text-sm mb-2 inline-block">
          ← Asian dramas
        </Link>
        <h1 className="text-2xl font-bold text-white">My rankings</h1>
        <p className="text-slate-400 mt-1">
          Drag to reorder (1 = favorite). This powers your taste point on the map and recommendations.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500"
        >
          Add drama
        </button>
        {saving && <span className="text-slate-400 text-sm self-center">Saving…</span>}
      </div>

      {showAdd && (
        <AddDramaModal
          existingIds={items.map((i) => i.drama_id)}
          onAdd={(row) => {
            setItems((prev) => [...prev, row].sort((a, b) => a.rank - b.rank));
            setShowAdd(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-slate-400 py-8 text-center">No dramas ranked yet. Add titles you’ve watched.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableRow key={item.id} item={item} onRemove={() => removeItem(item.id)} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function AddDramaModal({
  existingIds,
  onAdd,
  onClose,
}: {
  existingIds: number[];
  onAdd: (row: RankRow) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RankRow["drama"][]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from("dramas")
      .select("id, title, year, num_episodes, rating, image_url, genres, media_type")
      .ilike("title", `%${query.trim()}%`)
      .limit(20);
    setResults((data as RankRow["drama"][]) ?? []);
    setLoading(false);
  }

  async function addDrama(drama: RankRow["drama"]) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: maxRank } = await supabase
      .from("user_ranked_dramas")
      .select("rank")
      .eq("user_id", user.id)
      .eq("catalog", ASIAN_CATALOG)
      .order("rank", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRank = (maxRank?.rank ?? 0) + 1;
    const { data: inserted } = await supabase
      .from("user_ranked_dramas")
      .insert({
        user_id: user.id,
        catalog: ASIAN_CATALOG,
        drama_id: drama.id,
        rank: nextRank,
      })
      .select("id, user_id, catalog, drama_id, rank, notes")
      .single();

    if (inserted) {
      onAdd({
        ...inserted,
        drama,
      } as RankRow);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-drama-title"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="add-drama-title" className="font-semibold text-white">
            Add drama
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            ×
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search by title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
          />
          <button
            type="button"
            onClick={search}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          >
            Search
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {results.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
              <div className="relative w-10 h-14 rounded bg-slate-700 overflow-hidden shrink-0">
                {d.image_url ? (
                  <Image src={d.image_url} alt={d.title} fill className="object-cover" sizes="40px" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{d.title}</p>
                <p className="text-slate-400 text-xs">
                  {d.year} · {d.rating}
                </p>
              </div>
              <button
                type="button"
                onClick={() => addDrama(d)}
                disabled={existingIds.includes(d.id)}
                className="px-3 py-1 rounded bg-indigo-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {existingIds.includes(d.id) ? "Added" : "Add"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
