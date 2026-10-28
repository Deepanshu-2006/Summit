import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

// Temporary placeholder product name in metadata
export const metadata: Metadata = {
  title: "Platform [Preview] · Cloud Infrastructure",
  description: "Next-generation developer infrastructure and cloud deployment platform.",
};

export const viewport: Viewport = {
  themeColor: "#121416",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} dark`}
    >
      <body className="min-h-screen bg-bg-main text-text-primary font-sans antialiased selection:bg-accent-orange/25 selection:text-text-primary">
        {children}
      </body>
    </html>
  );
}
