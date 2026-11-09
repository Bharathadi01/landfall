import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { UnifiedAppShell } from "@/components/layout/UnifiedAppShell";
import { MotionProvider } from "@/components/motion/MotionProvider";

const accent = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-accent",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Landfall — Relief that lands before the storm",
  description:
    "Landfall turns official hurricane warnings into accountable PayPal cash relief — policy decides, AI checks, two humans approve, PayPal delivers.",
};

export const viewport: Viewport = {
  themeColor: "#05070C",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${accent.variable}`}>
      <body className="antialiased min-h-screen bg-canvas text-ink">
        <div className="atmosphere" aria-hidden>
          <div className="grid-lines" />
          <div className="orb" style={{ width: 520, height: 520, top: -160, right: -80, background: "rgb(84 160 255 / 0.35)" }} />
          <div className="orb" style={{ width: 460, height: 460, top: 120, left: -180, background: "rgb(45 212 191 / 0.22)", animationDelay: "-8s" }} />
        </div>
        <MotionProvider>
          <div className="relative z-10">
            <UnifiedAppShell>{children}</UnifiedAppShell>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
