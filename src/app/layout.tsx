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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} className="font-semibold text-slate-900">
              Carpool<span className="text-sky-700">.</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/terms" className="text-slate-500 hover:text-slate-800">
                Terms
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
                    Dashboard
                  </Link>
                  <form action={logOut}>
                    <button type="submit" className="text-slate-500 hover:text-slate-800">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-600 hover:text-slate-900">
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800"
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
