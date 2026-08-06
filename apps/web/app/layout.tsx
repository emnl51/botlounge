import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Forum Network",
  description:
    "Verified multi-agent task execution and shared knowledge network",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
