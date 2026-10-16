import Link from "next/link";
export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Link className="brand" href="/">
          ✳ TheStudioShot
        </Link>
        <p>Premium product visuals, built for the pace of commerce.</p>
      </div>
      <nav>
        <Link href="/features">Features</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/docs/api">API docs</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/refund-policy">Refunds</Link>
      </nav>
      <small>
        © {new Date().getFullYear()} TheStudioShot · Legal templates require
        review.
      </small>
    </footer>
  );
}
