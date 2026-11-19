"use client";

import { ErrorPanel } from "../_components/ErrorPanel";

/** Keeps the navigation bar (from the practice layout) above the error panel. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} />;
}
