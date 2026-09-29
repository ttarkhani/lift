import Link from "next/link";
import { LiftIcon } from "@/components/icons";
import { NavLinks } from "@/components/nav-links";
import { StatusBadge } from "@/components/status-badge";

const links = [
  { label: "Tour", href: "/demo", exact: true },
  { label: "Board", href: "/demo/board" },
  { label: "Leaderboard", href: "/demo/leaderboard" },
  { label: "Team Maple", href: "/demo/teams/maple" },
];

/** The demo's header: the same sand bar as the app's, with links that stay inside the demo. */
export function DemoHeader() {
  return (
    <header className="border-b-2 border-stamp bg-sand">
      <nav
        aria-label="Demo"
        className="mx-auto flex max-w-wide flex-wrap items-center justify-between gap-x-6 px-4 sm:flex-nowrap"
      >
        <Link href="/demo" className="inline-flex min-h-tap items-center gap-1.5 font-display text-xl font-extrabold text-stamp">
          <LiftIcon />
          Lifts
        </Link>
        <div className="flex min-h-tap items-center sm:order-last">
          <StatusBadge status="demo" />
        </div>
        <div className="-mx-2 w-full sm:mx-0 sm:w-auto sm:flex-1">
          <NavLinks links={links} />
        </div>
      </nav>
    </header>
  );
}
