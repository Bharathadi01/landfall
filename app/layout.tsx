import type { Metadata, Viewport } from "next";
import { Archivo, Public_Sans, Overpass_Mono } from "next/font/google";
import "./globals.css";
import { UnifiedAppShell } from "@/components/layout/UnifiedAppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { TourProvider } from "@/components/tour/TourProvider";

/**
 * Type, chosen for the people who read it under stress:
 *  - Archivo (expanded) for headlines: the wide, steady letterforms of public-information signage — calm authority, not drama.
 *  - Public Sans for everything people read: the U.S. Web Design System face, built for public-service forms read by everyone,
 *    including people in a crisis. Residents meet the same type they would on a government relief form.
 *  - Overpass Mono for identifiers only: from the Highway Gothic lineage of U.S. road signs — the evacuation-route signs families follow.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const ui = Public_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const data = Overpass_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Landfall — Relief that lands before the storm",
  description:
    "Landfall turns official hurricane warnings into accountable PayPal cash relief — policy decides, AI checks, two humans approve, PayPal delivers.",
};

export const viewport: Viewport = {
  themeColor: "#F6F3EC",
  colorScheme: "light",
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
              <TourProvider />
            </ToastProvider>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
