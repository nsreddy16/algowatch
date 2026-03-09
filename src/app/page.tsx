import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-white mb-4">Algowatch</h1>
      <p className="text-slate-300 text-lg mb-8">
        Discover and rank Asian dramas. Get recommendations and explore your taste on the map.
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/asian-dramas"
          className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
        >
          Browse Asian Dramas
        </Link>
        <Link
          href="/auth/login"
          className="px-6 py-3 rounded-lg glass text-slate-200 font-medium hover:bg-slate-700/50 transition-colors"
        >
          Log in to save your list
        </Link>
      </div>
    </div>
  );
}
