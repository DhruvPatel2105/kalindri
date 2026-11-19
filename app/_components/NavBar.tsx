"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { logout } from "@/lib/auth/actions";
import { NAV_SECTIONS } from "@/lib/questions/navigation";
import { isPractisable } from "@/lib/questions/practisable";

/**
 * The navigation bar. "Practice" opens a menu of the question types in four
 * columns — Speaking, Writing, Reading, Listening — each type listed once, in
 * the section of the test where it is sat (lib/questions/navigation.ts).
 * Types you can practise today are links; the rest are greyed out. It shows
 * on every page, including while a test is being taken.
 */
export function NavBar({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Close whatever is open when the page changes.
  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    }
    function onClick(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const link = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return `rounded px-3 py-2 text-sm font-medium ${
      active ? "bg-[#eaf2f1] text-[#17544f]" : "text-[#3d4a48] hover:bg-[#f4f2ee] hover:text-[#1f6f6b]"
    }`;
  };

  const menu = (
    <div className="px-2 pb-4 pt-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="border-b border-[#e6e2d9] pb-2 text-base font-semibold text-[#1e2a2a]">
              {section.title}
            </h3>
            <ul className="mt-1">
              {section.items.map((item) => (
                <li key={item.label}>
                  {item.type && isPractisable(item.type) ? (
                    <Link
                      href={`/practice/${item.type}`}
                      className="block rounded px-1 py-2 text-sm text-[#1e2a2a] hover:bg-[#f4f2ee] hover:text-[#1f6f6b]"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="block px-1 py-2 text-sm text-[#b3b9b6]" title="Coming soon">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <header ref={navRef} className="relative z-40 border-b border-[#e6e2d9] bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="mr-3 text-xl font-semibold tracking-tight text-[#17544f]">
          Kalindri
        </Link>

        {/* desktop links */}
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link href="/" className={link("/", true)}>
            Home
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            onMouseEnter={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="practice-menu"
            className={`flex items-center gap-1 rounded px-3 py-2 text-sm font-medium ${
              menuOpen || pathname.startsWith("/practice")
                ? "bg-[#eaf2f1] text-[#17544f]"
                : "text-[#3d4a48] hover:bg-[#f4f2ee] hover:text-[#1f6f6b]"
            }`}
          >
            Practice <span aria-hidden="true" className="text-[10px]">{menuOpen ? "▲" : "▼"}</span>
          </button>
          <Link href="/mock/reading" className={link("/mock")}>
            Mock test
          </Link>
          <Link href="/practice/history" className={link("/practice/history")}>
            Test history
          </Link>
          {isAdmin ? (
            <Link href="/admin/users" className={link("/admin")}>
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span className="max-w-[14rem] truncate text-xs text-[#7d8a88]">{email}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded border border-[#dcd8cf] bg-white px-3 py-1.5 text-sm font-medium text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
            >
              Log out
            </button>
          </form>
        </div>

        {/* mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Menu"
          className="ml-auto rounded border border-[#dcd8cf] px-3 py-1.5 text-sm font-medium text-[#1e2a2a] md:hidden"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* desktop mega menu */}
      {menuOpen ? (
        <div
          id="practice-menu"
          onMouseLeave={() => setMenuOpen(false)}
          className="absolute inset-x-0 top-full hidden border-b border-[#e6e2d9] bg-white shadow-lg md:block"
        >
          {menu}
        </div>
      ) : null}

      {/* mobile menu */}
      {mobileOpen ? (
        <div className="max-h-[80vh] overflow-y-auto border-t border-[#e6e2d9] bg-white md:hidden">
          <div className="flex flex-col gap-1 px-4 py-3">
            <Link href="/" className={link("/", true)}>
              Home
            </Link>
            <Link href="/mock/reading" className={link("/mock")}>
              Mock test
            </Link>
            <Link href="/practice/history" className={link("/practice/history")}>
              Test history
            </Link>
            {isAdmin ? (
              <Link href="/admin/users" className={link("/admin")}>
                Admin
              </Link>
            ) : null}
          </div>
          <p className="px-4 text-xs font-semibold uppercase tracking-wide text-[#7d8a88]">Practice</p>
          {menu}
          <div className="flex items-center justify-between border-t border-[#e6e2d9] px-4 py-3">
            <span className="truncate text-xs text-[#7d8a88]">{email}</span>
            <form action={logout}>
              <button type="submit" className="rounded border border-[#dcd8cf] px-3 py-1.5 text-sm font-medium text-[#1e2a2a]">
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </header>
  );
}
