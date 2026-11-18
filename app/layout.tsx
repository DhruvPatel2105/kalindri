import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-libre-franklin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kalindri",
  description: "PTE Core practice and AI-scoring platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={libreFranklin.variable}>
      <body style={{ fontFamily: "var(--font-libre-franklin), Helvetica, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
