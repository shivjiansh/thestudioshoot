"use client";
import { useEffect } from "react";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("TheStudioShot route error", error); }, [error]);
  return <main className="status-page"><div className="status-mark" aria-hidden="true">!</div><h1>Something went wrong.</h1><p>Your work has not been marked successful. You can retry this page or return to the dashboard.</p><div className="status-actions"><button className="button dark" onClick={reset}>Try again</button><a className="button light" href="/dashboard">Dashboard</a></div></main>;
}
