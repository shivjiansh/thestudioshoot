import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) {
    const pathname = (await headers()).get("x-studioshot-pathname") ?? "/dashboard";
    const callbackUrl = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard";
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return <AppShell>{children}</AppShell>;
}
