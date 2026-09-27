"use client";

import { useEffect, useRef } from "react";

export const POLL_INTERVAL_MS = 4000;

/**
 * Calls `callback` every `intervalMs` while the tab is visible. It pauses while the tab is
 * hidden, runs once as soon as the tab is shown again, and never overlaps two calls.
 */
export function usePoll(callback: () => unknown, intervalMs = POLL_INTERVAL_MS): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let running = false;

    async function tick() {
      if (running || document.hidden) return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    }

    function start() {
      clearInterval(timer);
      timer = setInterval(tick, intervalMs);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        void tick();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}
