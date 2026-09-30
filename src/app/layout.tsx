import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["500", "700", "900"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "MergeCity: claim your plot on the MergeMate waitlist",
  description: `${SITE.pitch} Join the waitlist and claim your plot in MergeCity.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#060a14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${orbitron.variable} ${grotesk.variable} ${mono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
