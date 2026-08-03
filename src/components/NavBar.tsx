"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/photos", label: "Photos" },
  { href: "/venues", label: "Venues" },
  { href: "/series", label: "Favorites" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    // Fixed rather than sticky: sticky needs a scroll container with room to
    // move, which a last-flex-child never has, so it silently sat at the end of
    // the document instead of pinning to the bottom of the screen.
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-lg">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 py-3 text-center text-sm font-medium ${
                active
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
