import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { themeInitScript } from "@/components/theme-init";

import "./globals.css";
import "./design.css";
import "./theme.css";

export const metadata: Metadata = {
  title: { default: "RecoveryOS — Payment recovery, with confidence", template: "%s | RecoveryOS" },
  description: "Operational payment recovery, evidence, and safety workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}<Analytics /></body>
    </html>
  );
}
