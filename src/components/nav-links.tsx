"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

export function NavLinks({ links }: { links: { label: string; href: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-wrap gap-1 pb-2 sm:pb-0">
      {links.map(({ label, href }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
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
