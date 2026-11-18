"use client";

import { useEffect, useState } from "react";

/**
 * A timestamp shown in the viewer's own time zone. Rendered empty on the
 * server and filled in after hydration, so the server's zone never leaks in
 * and the markup can't mismatch.
 */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    );
  }, [iso]);
  return <time dateTime={iso}>{text || " "}</time>;
}
