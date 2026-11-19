"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { HEARTBEAT_INTERVAL_S, IDLE_THRESHOLD_S } from "@/lib/activity/activity";

/**
 * Tells the server the student is actively using the app, so the admin can see
 * how long they study. Renders nothing.
 *
 * It sends a heartbeat every HEARTBEAT_INTERVAL_S seconds, but only while the
 * tab is VISIBLE and the student has touched the page (mouse, keys, touch,
 * scroll) within IDLE_THRESHOLD_S. A background tab, a closed tab, a student
 * who walked away, or a dead network sends nothing. The server decides how
 * much time each heartbeat is worth, so several open tabs never count the same
 * minute twice.
 */
export function ActivityTracker() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const lastInteraction = useRef(0);
  const lastSent = useRef(0);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    lastInteraction.current = Date.now(); // opening a page is an interaction

    function active(): boolean {
      return (
        document.visibilityState === "visible" &&
        Date.now() - lastInteraction.current <= IDLE_THRESHOLD_S * 1000
      );
    }

    function beat() {
      // Never more than one per few seconds from this tab (e.g. a burst of events).
      if (!active() || Date.now() - lastSent.current < 5000) return;
      lastSent.current = Date.now();
      void fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathRef.current }),
        keepalive: true,
      }).catch(() => {
        // offline or the server is busy: the next heartbeat covers it
      });
    }

    function touch() {
      lastInteraction.current = Date.now();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        touch();
        beat();
      }
    }

    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_S * 1000);
    beat();

    return () => {
      for (const name of events) window.removeEventListener(name, touch);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, []);

  return null;
}
