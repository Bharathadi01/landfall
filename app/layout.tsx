import type { Metadata, Viewport } from "next";
import { Fraunces, Schibsted_Grotesk, Martian_Mono } from "next/font/google";
import "./globals.css";
import { UnifiedAppShell } from "@/components/layout/UnifiedAppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { MotionProvider } from "@/components/motion/MotionProvider";

const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const ui = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const data = Martian_Mono({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Landfall — Relief that lands before the storm",
  description:
    "Landfall turns official hurricane warnings into accountable PayPal cash relief — policy decides, AI checks, two humans approve, PayPal delivers.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  colorScheme: "dark",
};

/**
 * Shared SVG filter for liquid-glass refraction (Chromium: backdrop-filter: url(#lg-refract)).
 * Other engines ignore it and fall back to plain blur.
 */
function GlassDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <filter id="lg-refract" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2.2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${data.variable}`}>
      <body className="antialiased min-h-screen bg-canvas text-ink grain">
        <GlassDefs />
        <div className="vignette" aria-hidden />
        <MotionProvider>
          <div className="relative z-10">
            <ToastProvider>
              <UnifiedAppShell>{children}</UnifiedAppShell>
            </ToastProvider>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
