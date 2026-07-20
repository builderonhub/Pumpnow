"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section className="shell" role="alert" aria-live="assertive">
      <h1>Something went wrong</h1>
      <p>The page could not be loaded. Your wallet and funds are unaffected.</p>
      <button type="button" onClick={reset}>Try again</button>
    </section>
  );
}
