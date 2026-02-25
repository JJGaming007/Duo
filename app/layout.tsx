import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/providers/ToastProvider";
import NotificationProvider from "@/components/providers/NotificationProvider";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodeTrack Duo",
  description: "Track your 100 Days of Code journey with your partner.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CodeTrack Duo",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png"
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-zinc-100 antialiased h-[100dvh] pt-14 pb-16 md:pb-0 md:pt-16 overflow-hidden flex flex-col`}>
        <Navbar />
        <main className="mx-auto max-w-7xl flex-1 overflow-y-auto overflow-x-hidden w-full">
          {children}
        </main>
        <ToastProvider />
        <NotificationProvider />
      </body>
    </html>
  );
}
