import Link from "next/link";
export default function NotFound() {
  return <main className="status-page"><div className="eyebrow">404 · NOT FOUND</div><h1>This page isn't in the frame.</h1><p>The link may be old, or the page may have moved.</p><div className="status-actions"><Link className="button dark" href="/">Back to home</Link><Link className="button light" href="/studio">Open studio</Link></div></main>;
}
