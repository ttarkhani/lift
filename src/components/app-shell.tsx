import Link from "next/link";
import { connection } from "next/server";
import { getViewer } from "@/server/auth/guards";
import { isOrganizer } from "@/server/auth/viewer";
import { cx } from "@/lib/cx";
import { LiftIcon } from "./icons";
import { NavLinks } from "./nav-links";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // The header depends on the session, so every page renders per request.
  await connection();
  const viewer = await getViewer();
  const organizer = viewer !== null && isOrganizer(viewer);

  const links = [
    { label: "Board", href: "/board" },
    { label: "Leaderboard", href: "/leaderboard" },
  ];
  if (viewer?.team) links.push({ label: "My team", href: `/teams/${viewer.team.slug}` });
  if (organizer) {
    links.push({ label: "Review queue", href: "/organizer/review" });
    links.push({ label: "Teams", href: "/organizer/teams" });
  }

  const authLink =
    "inline-flex min-h-tap items-center font-bold text-stamp underline underline-offset-4 hover:text-ink";

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
          {/* Plain anchors: the Auth0 routes are served by the proxy, not the client router. */}
          <div className="flex items-center gap-4 sm:order-last">
            {viewer ? (
              <>
                <p className="text-sm text-ink-soft">
                  {viewer.team ? (
                    `Team ${viewer.team.name}`
                  ) : organizer ? (
                    "Organizer"
                  ) : (
                    <Link href="/join" className="underline underline-offset-4 hover:text-ink">
                      Join your team
                    </Link>
                  )}
                </p>
                <a href="/auth/logout" className={authLink}>
                  Log out
                </a>
              </>
            ) : (
              <a href="/auth/login" className={authLink}>
                Log in
              </a>
            )}
          </div>
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
