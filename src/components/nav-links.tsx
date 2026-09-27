"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

export function NavLinks({ links }: { links: { label: string; href: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex gap-1">
      {links.map(({ label, href }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={cx(
                "inline-flex min-h-tap items-center border-b-3 px-2 font-bold",
                current ? "border-stamp text-ink" : "border-transparent text-ink-soft hover:text-ink",
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
