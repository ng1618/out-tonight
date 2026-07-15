"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/venues", label: "Venues" },
  { href: "/series", label: "Favorites" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
    </nav>
  );
}
