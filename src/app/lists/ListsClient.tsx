"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { List } from "@/lib/types";

type Props = { initialLists: List[] };

export function ListsClient({ initialLists }: Props) {
  const [lists, setLists] = useState(initialLists);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);
    const { data, error } = await supabase
      .from("lists")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        is_public: isPublic,
        share_slug: slug + "-" + Date.now().toString(36),
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      console.error(error);
      return;
    }
    setLists((prev) => [data as List, ...prev]);
    setShowCreate(false);
    setName("");
    setDescription("");
    setIsPublic(false);
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list?")) return;
    await supabase.from("lists").delete().eq("id", id);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">My Lists</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500"
        >
          New list
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={createList}
          className="glass rounded-xl p-6 mb-8 space-y-4"
        >
          <h2 className="font-semibold text-white">Create list</h2>
          <input
            type="text"
            placeholder="List name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white min-h-[80px]"
          />
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public (shareable link)
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg glass text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {lists.length === 0 ? (
          <p className="text-slate-400">No lists yet. Create one to start ranking dramas.</p>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              className="glass rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <Link
                  href={`/lists/${list.share_slug ?? list.id}`}
                  className="font-medium text-white hover:text-indigo-300"
                >
                  {list.name}
                </Link>
                {list.description && (
                  <p className="text-slate-400 text-sm mt-0.5">{list.description}</p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  {list.is_public ? "Public" : "Private"} · Share: /lists/{list.share_slug ?? list.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/lists/${list.share_slug ?? list.id}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                >
                  Edit
                </Link>
                <button
                  onClick={() => deleteList(list.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-500/50 text-red-400 text-sm hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
