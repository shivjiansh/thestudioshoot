import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "TheStudioShot — AI Product Photography",
    template: "%s | TheStudioShot",
  },
  description:
    "Create premium studio-quality product imagery for e-commerce, ads, and social media with AI.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
