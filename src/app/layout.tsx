import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logOut } from "./actions/auth";

export const metadata: Metadata = {
  title: "Carpool — parent-to-parent carpool coordination",
  description:
    "Organize recurring school, sports and activity carpools with parents you already know.",
};

const navLinkClass = "flex min-h-11 items-center rounded-lg px-2";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-1">
            <Link
              href={user ? "/dashboard" : "/"}
              className="flex min-h-11 items-center font-semibold text-slate-900"
            >
              Carpool<span className="text-sky-700">.</span>
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <Link href="/terms" className={`${navLinkClass} text-slate-500 hover:text-slate-800`}>
                Terms
              </Link>
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`${navLinkClass} text-slate-600 hover:text-slate-900`}
                  >
                    Dashboard
                  </Link>
                  <form action={logOut}>
                    <button
                      type="submit"
                      className={`${navLinkClass} text-slate-500 hover:text-slate-800`}
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`${navLinkClass} text-slate-600 hover:text-slate-900`}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className={`${navLinkClass} rounded-lg bg-sky-700 font-medium text-white hover:bg-sky-800`}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
