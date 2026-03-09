"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const supabase = createClient();

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({
      type: "ok",
      text: "Check your email for the confirmation link.",
    });
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-white mb-6">Sign up</h1>
      {message && (
        <p
          className={`mb-4 text-sm ${
            message.type === "ok" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}
      <form onSubmit={signUp} className="space-y-4">
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
          minLength={6}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          Sign up
        </button>
      </form>
      <p className="mt-6 text-center text-slate-400 text-sm">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-indigo-400 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
