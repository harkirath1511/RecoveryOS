import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./slush.css";

export const metadata: Metadata = {
  title: "RecoveryOS",
  description: "Operational payment recovery, evidence, and safety workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
