"use client";

import { usePathname } from "next/navigation";

/** True for the public demo's pages, which have their own header and nav. */
export function isDemoPath(pathname: string): boolean {
  return pathname === "/demo" || pathname.startsWith("/demo/");
}

/**
 * Shows the demo's header on /demo and the pages under it, and the app's header everywhere
 * else. Both are rendered on the server; this only picks one.
 */
export function HeaderSwitch({ app, demo }: { app: React.ReactNode; demo: React.ReactNode }) {
  return isDemoPath(usePathname()) ? demo : app;
}
