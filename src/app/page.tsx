import { Page } from "@/components/app-shell";
import { Button, buttonClasses } from "@/components/button";
import { getPageViewer, loginHref } from "@/server/auth/pages";

const steps = [
  { title: "Join your team", body: "Use the invite code from the organizers and list what you can help with." },
  { title: "Post a blocker", body: "Say what's broken, add tags, and share what you already tried." },
  { title: "Another team helps", body: "They get a private thread to chat, share code, or meet at your table." },
  { title: "Confirm it's fixed", body: "The helpers show what they did. Your team confirms it or sends it back." },
  { title: "Helpers earn points", body: "The helping team gets points and a line on its contribution receipt." },
];

export default async function Home() {
  const viewer = await getPageViewer();

  return (
    <>
      <section
        aria-labelledby="hero"
        className="relative -mx-4 -mt-6 mb-8 overflow-hidden border-b-2 border-stamp bg-sunset px-4 pt-8 pb-10"
      >
        <div className="relative mx-auto max-w-page">
          <Leaves />
          <h1 id="hero" className="display-outline text-hero font-extrabold">
            Lifts
          </h1>
          <p className="mt-4 inline-block rounded-full bg-stamp px-4 py-1.5 font-display font-medium text-paper">
            Sept. 25–27, 2026 at uOttawa
          </p>
          <p className="mt-5 font-display text-xl font-bold text-balance text-ink sm:text-2xl">
            Get unstuck faster by helping each other.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {viewer ? (
              <Button href="/board" block>
                Go to the board
              </Button>
            ) : (
              <>
                {/* A plain anchor: /auth/login is served by the proxy. */}
                <a href={loginHref("/join")} className={buttonClasses({ block: true })}>
                  Log in to join your team
                </a>
                <Button href="/board" variant="secondary" block>
                  See the board
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <Page>
        <p className="text-lg text-ink">
          Lifts rewards hackathon teams for helping other teams get unblocked,
          with evidence behind every point.
        </p>

        <section aria-labelledby="how" className="mt-10">
          <h2 id="how" className="text-lg font-bold">
            How it works
          </h2>
          <ol className="mt-3 divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 px-4 py-3">
                <span className="font-mono text-lg font-bold text-stamp tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold">{step.title}</p>
                  <p className="text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="points" className="mt-10">
          <h2 id="points" className="text-lg font-bold">
            How points work
          </h2>
          <p className="mt-2 text-ink-soft">
            Points go to the helping team, once per blocker, and count per pair of
            teams across the whole event, in either direction.
          </p>
          <dl className="mt-3 grid grid-cols-3 rounded-md border-2 border-rule bg-paper text-center">
            {[
              ["1st fix", "20"],
              ["2nd fix", "5"],
              ["After that", "0"],
            ].map(([label, points]) => (
              <div key={label} className="border-rule px-2 py-3 not-last:border-r-2">
                <dt className="text-sm text-ink-soft">{label}</dt>
                <dd className="font-mono text-xl font-bold">{points}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-soft">
            Helping a new team always starts at 20. Messages, time spent, and
            reopened blockers never earn points.
          </p>
        </section>
      </Page>
    </>
  );
}

/** A few still leaves in the hero's corner, drawn as simple ovals with a vein. Decoration only. */
function Leaves() {
  const leaves = [
    { className: "top-2 right-2 size-14 rotate-[35deg] text-brick", vein: "var(--color-ground)" },
    { className: "top-16 right-16 size-10 -rotate-[25deg] text-marker", vein: "var(--color-stamp)" },
    { className: "top-20 -right-1 size-8 rotate-[80deg] text-stamp", vein: "var(--color-sand)" },
  ];
  return leaves.map(({ className, vein }) => (
    <svg
      key={className}
      viewBox="-12 -21 24 42"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute ${className}`}
    >
      <path d="M0 -20C11 -12 11 8 0 20C-11 8 -11 -12 0 -20Z" fill="currentColor" />
      <path d="M0 -14V16" stroke={vein} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ));
}
