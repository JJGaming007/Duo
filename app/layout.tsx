import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/providers/ToastProvider";
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
      <body className={`${inter.className} bg-black text-zinc-100 antialiased min-h-screen pt-14 pb-20 md:pb-0 md:pt-16`}>
        <Navbar />
        <main className="mx-auto max-w-lg md:max-w-7xl px-4 py-8">
          {children}
        </main>
        <ToastProvider />
      </body>
    </html>
  );
}
