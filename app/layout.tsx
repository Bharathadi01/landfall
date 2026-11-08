import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Landfall — Cash Before the Storm",
  description: "Anticipatory mutual aid powered by PayPal and AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
