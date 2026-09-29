"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

type NavLink = {
  label: string;
  href: string;
  /** Only current on this exact path, not on the paths under it (the demo's tour at /demo). */
  exact?: boolean;
};

export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-wrap gap-1 pb-2 sm:pb-0">
      {links.map(({ label, href, exact }) => {
        const current = pathname === href || (!exact && pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={cx(
                "inline-flex min-h-tap items-center rounded-full px-4 font-display font-medium",
                current ? "bg-stamp text-paper" : "text-ink hover:bg-paper",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
