import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Out Tonight",
  description: "Everything worth going to, in one feed",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Out Tonight",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* pb-24 reserves room for the fixed nav so the last card isn't hidden
          behind it; dvh tracks mobile browser chrome as it shows and hides. */}
      <body className="min-h-dvh bg-zinc-50 pb-24 dark:bg-black">
        <div className="mx-auto flex w-full max-w-lg flex-col">{children}</div>
        <NavBar />
      </body>
    </html>
  );
}
