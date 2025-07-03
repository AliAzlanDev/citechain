import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import PlausibleProvider from "next-plausible";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "CiteChain - Automated Citation Searching";
const description =
  "A supplementary citation search tool for systematic reviews to increase search sensitivity.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL("https://citechain.aliazlan.me"),
  authors: [
    {
      name: "Ali Azlan",
      url: "https://aliazlan.me",
    },
    {
      name: "Wajeeha Fatima Tareen",
    },
    {
      name: "Abdul Wahab Mirza",
    },
    {
      name: "Abraiz Ahmad",
    },
    {
      name: "Zoha Rafaqat",
    },
    {
      name: "Sophia Ahmed",
    },
  ],
  creator: "Ali Azlan",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://citechain.aliazlan.me",
    title,
    description,
    images: [
      {
        url: `https://citechain.aliazlan.me/banner.png`,
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@AliAzlanReal",
    images: ["https://citechain.aliazlan.me/banner.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <PlausibleProvider
        domain="citechain.aliazlan.me"
        customDomain="https://analytics.aliazlan.me"
        selfHosted
      >
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <div className="relative grid min-h-screen grid-cols-[auto] md:grid-cols-[1fr_2.5rem_auto_2.5rem_1fr] grid-rows-[2.5rem_1px_auto_1px_3.5rem] [--pattern-fg:var(--color-primary)]/10 ">
            <div className="col-span-1 md:col-start-3 row-start-3 flex max-w-5xl flex-col p-4 bg-muted overflow-hidden">
              {children}
            </div>
            <div className="relative -right-px md:col-start-2 row-span-full row-start-1 border-x border-x-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed hidden md:block"></div>
            <div className="relative -left-px md:col-start-4 row-span-full row-start-1 border-x border-x-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed hidden md:block"></div>
            <div className="relative -bottom-px col-span-full col-start-1 row-start-2 h-px bg-(--pattern-fg)"></div>
            <div className="relative -top-px col-span-full col-start-1 row-start-4 h-px bg-(--pattern-fg)"></div>
            <div className="col-span-1 md:col-start-3 row-start-5 text-sm max-w-4xl p-4">
              Developed with ❤️ by{" "}
              <a
                href="https://aliazlan.me"
                target="_blank"
                className="text-primary underline underline-offset-4 hover:decoration-4"
              >
                Ali Azlan
              </a>
            </div>
          </div>
          <Toaster richColors theme="light" />
        </body>
      </PlausibleProvider>
    </html>
  );
}
