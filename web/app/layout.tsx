import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
import "./globals.css";

const body = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "VoiceCart — the talking cloth shop",
  description: "A clothing shop you can talk to. Built for shoppers who know what they want and do not want to click through a grid.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-body)]">{children}</body>
    </html>
  );
}
