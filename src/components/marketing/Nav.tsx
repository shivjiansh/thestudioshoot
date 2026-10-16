"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <Sparkles size={18} /> TheStudioShot
      </Link>
      <button
        className="menu-toggle"
        aria-label="Toggle navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav className={open ? "nav nav-open" : "nav"}>
        <Link href="/features">Features</Link>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/docs">Developers</Link>
        <Link href="/login">Sign in</Link>
        <Link className="button dark" href="/studio">
          Open Studio ↗
        </Link>
      </nav>
    </header>
  );
}
