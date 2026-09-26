import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifts",
  description: "Earn points for helping other hackathon teams get unblocked.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
