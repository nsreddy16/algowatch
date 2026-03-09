"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const supabase = createClient();

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({ type: "ok", text: "Signed in. Redirecting…" });
    window.location.href = "/lists";
  }

  async function signInWithOAuth(provider: "google" | "github") {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-white mb-6">Log in</h1>
      {message && (
        <p
          className={`mb-4 text-sm ${
            message.type === "ok" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}
      <form onSubmit={signInWithEmail} className="space-y-4 mb-6">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          Sign in with email
        </button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-slate-900 text-slate-400">Or continue with</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => signInWithOAuth("google")}
          disabled={loading}
          className="flex-1 py-2 rounded-lg glass text-slate-200 font-medium hover:bg-slate-700/50 disabled:opacity-50"
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => signInWithOAuth("github")}
          disabled={loading}
          className="flex-1 py-2 rounded-lg glass text-slate-200 font-medium hover:bg-slate-700/50 disabled:opacity-50"
        >
          GitHub
        </button>
      </div>
      <p className="mt-6 text-center text-slate-400 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-indigo-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
