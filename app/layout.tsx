import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { UnifiedAppShell } from "@/components/layout/UnifiedAppShell";

export const metadata: Metadata = {
  title: "Landfall — Field Atlas · Anticipatory Disaster Relief",
  description: "Disaster intelligence, emergency funding, and accountable payouts in one workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased min-h-screen flex flex-col bg-[#F4F2EC] text-[#192A24] selection:bg-[#E0EEE7] selection:text-[#175B47]">
        <UnifiedAppShell>{children}</UnifiedAppShell>
      </body>
    </html>
  );
}
