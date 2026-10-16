"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, GalleryHorizontal, History, ImagePlus, KeyRound, LayoutDashboard, LogOut, Settings, Sparkles } from "lucide-react";
const links = [
  ["/dashboard", "Overview", LayoutDashboard], ["/studio", "AI Studio", ImagePlus],
  ["/gallery", "Gallery", GalleryHorizontal], ["/history", "History", History],
  ["/billing", "Billing", CreditCard], ["/developer", "Developer API", KeyRound], ["/settings", "Settings", Settings],
] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [busy, setBusy] = useState(false); const [logoutError, setLogoutError] = useState("");
  async function logout() { setBusy(true); setLogoutError(""); try { const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); if (!response.ok) throw new Error("Server could not clear your session. Please retry."); router.replace("/login"); router.refresh(); } catch (error) { setLogoutError(error instanceof Error ? error.message : "Sign out failed."); } finally { setBusy(false); } }
  return <div className="app-layout"><aside className="sidebar"><Link className="brand" href="/"><Sparkles size={18}/> TheStudioShot</Link><small>WORKSPACE</small>{links.map(([href,label,Icon])=>{const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)); return <Link key={href} className={active?"side active":"side"} href={href} aria-current={active?"page":undefined}><Icon size={16}/>{label}</Link>})}<button type="button" className="side logout-button" onClick={logout} disabled={busy}><LogOut size={16}/>{busy?"Signing out…":"Sign out"}</button><Link className="back" href="/">← Back to website</Link></aside><main className="app-main"><div className="mobile-head"><Link className="brand" href="/">✳ TheStudioShot</Link><button type="button" onClick={logout} disabled={busy}>{busy?"Signing out…":"Sign out ↗"}</button></div>{logoutError && <p className="error" role="alert">{logoutError}</p>}{children}</main></div>;
}
