import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-slate-400 mb-6">The page you’re looking for doesn’t exist.</p>
      <Link href="/" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500">
        Go home
      </Link>
    </div>
  );
}
