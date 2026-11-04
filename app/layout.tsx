import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastProvider from "@/components/providers/ToastProvider";
import RealtimeProvider from "@/components/providers/RealtimeProvider";
import SWRProvider from "@/components/providers/SWRProvider";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Duo",
  description: "Pray, talk and grow together.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Duo",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
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
  // Android: shrink the page when the keyboard opens (iOS ignores this; see lib/keyboard.ts)
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-black">
      <body
        className={`flex h-[100dvh] flex-col overflow-hidden bg-black font-sans pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-white antialiased md:pb-0 md:pt-14`}
      >
        <SWRProvider>
          <Navbar />
          <main className="w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">{children}</main>
          <RealtimeProvider />
        </SWRProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
