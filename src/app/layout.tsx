import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "0x01 Mesh Explorer | Real-Time Network Activity",
  description:
    "Explore the 0x01 decentralized agent mesh network. Real-time visualization of agents, quests, and on-chain activity across the globe.",
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },
  openGraph: {
    title: "0x01 Mesh Explorer",
    description:
      "Real-time visualization of the 0x01 decentralized agent mesh network.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
