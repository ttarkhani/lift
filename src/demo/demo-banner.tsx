import Link from "next/link";

const link = "inline-flex min-h-tap items-center font-bold text-stamp underline underline-offset-4 hover:text-ink";

/** The quiet note at the top of every demo page. */
export function DemoBanner() {
  return (
    <aside
      aria-label="About this demo"
      className="mb-6 rounded-md border-2 border-dotted border-ink bg-paper px-4 pt-3 pb-1 text-sm"
    >
      <p>This is a demo with invented teams. Nothing here is real or saved.</p>
      <p className="flex flex-wrap gap-x-5">
        <Link href="/" className={link}>
          Back to Lifts
        </Link>
        {/* A plain anchor: /auth/login is served by the proxy. */}
        <a href="/auth/login" className={link}>
          Log in
        </a>
      </p>
    </aside>
  );
}
