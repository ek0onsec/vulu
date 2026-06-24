import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ToastViewport } from "@/components/ToastViewport";

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
      <head>
        {/* Dev uniquement : neutralise le throw « negative time stamp » de la piste perf
            Server Components (React 19.2 / Next 16.2). Retiré du build de production. */}
        {process.env.NODE_ENV !== "production" && <script src="/dev-perf-guard.js" />}
        {/* No-flash de thème : script externe render-blocking, exécuté avant le premier paint. */}
        <script src="/theme-no-flash.js" />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
        <ToastViewport />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
