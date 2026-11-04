import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/providers/ToastProvider";
import NotificationProvider from "@/components/providers/NotificationProvider";
import { Navbar } from "@/components/layout/Navbar";
import SWRProvider from "@/components/providers/SWRProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

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
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-black">
      <body className={`${inter.className} bg-black text-zinc-100 antialiased h-[100dvh] pt-14 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pt-16 overflow-hidden flex flex-col`}>
        <Navbar />
        <SWRProvider>
          <main className="mx-auto max-w-7xl flex-1 overflow-y-auto overflow-x-hidden overscroll-contain w-full">
            {children}
          </main>
        </SWRProvider>
        <ToastProvider />
        <NotificationProvider />
      </body>
    </html>
  );
}
