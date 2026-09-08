import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CFM Credit & Tier Management",
  description: "Core Frame Media — Executive & PM performance tracking (SOP-EXEC-001 v4.0)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
