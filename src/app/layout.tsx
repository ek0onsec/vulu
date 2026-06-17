import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ThemeProvider, themeNoFlashScript } from "@/components/ThemeProvider";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "vulu — vu & lu",
  description: "Tes films, séries et livres, entre amis.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#9461C0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${display.variable} ${body.variable} h-full antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} /></head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
