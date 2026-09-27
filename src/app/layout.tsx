import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
} from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
});

export const metadata: Metadata = {
  title: { default: "Lifts", template: "%s · Lifts" },
  description: "Earn points for helping other hackathon teams get unblocked.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
