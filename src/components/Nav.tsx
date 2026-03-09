"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function Nav() {
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/asian-dramas", label: "Asian Dramas" },
    { href: "/anime", label: "Anime" },
    ...(user ? [{ href: "/lists", label: "My Lists" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 glass border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="font-bold text-lg text-indigo-300">
          Algowatch
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === href || (href !== "/" && pathname.startsWith(href))
                  ? "bg-slate-700/80 text-white"
                  : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="relative">
          {user ? (
            <>
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700/50"
              >
                <span className="truncate max-w-[120px]">{user.email}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </button>
              {open && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 py-1 glass rounded-lg shadow-xl z-20">
                    <Link
                      href="/lists"
                      className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
                      onClick={() => setOpen(false)}
                    >
                      My Lists
                    </Link>
                    <button
                      type="button"
                      className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = "/";
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <Link
              href="/auth/login"
              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
