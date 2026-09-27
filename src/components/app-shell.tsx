import Link from "next/link";
import { cx } from "@/lib/cx";
import { CURRENT_TEAM_SLUG } from "@/lib/mock";
import { LiftIcon } from "./icons";
import { NavLinks } from "./nav-links";

export function AppShell({ children }: { children: React.ReactNode }) {
  const links = [
    { label: "Board", href: "/board" },
    { label: "Leaderboard", href: "/leaderboard" },
    { label: "My team", href: `/teams/${CURRENT_TEAM_SLUG}` },
  ];

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-10 focus:rounded-sm focus:bg-paper focus:px-4 focus:py-2 focus:font-bold"
      >
        Skip to content
      </a>
      <header className="border-b-2 border-rule bg-paper">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-wide flex-wrap items-center justify-between gap-x-6 px-4 sm:flex-nowrap"
        >
          <Link href="/" className="inline-flex min-h-tap items-center gap-1.5 text-xl font-bold">
            <LiftIcon className="text-stamp" />
            Lifts
          </Link>
          {/* Sign-in slot. Step 2 connects this to Auth0. */}
          <Link
            href="/auth/login"
            className="inline-flex min-h-tap items-center font-bold text-stamp underline underline-offset-4 hover:text-ink sm:order-last"
          >
            Log in
          </Link>
          <div className="-mx-2 w-full sm:mx-0 sm:w-auto sm:flex-1">
            <NavLinks links={links} />
          </div>
        </nav>
      </header>
      <main id="main" className="px-4 pt-6 pb-16">
        {children}
      </main>
    </>
  );
}

/** Page width: one 40rem column, or 72rem for organizer screens. */
export function Page({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return <div className={cx("mx-auto w-full", wide ? "max-w-wide" : "max-w-page")}>{children}</div>;
}
