import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { AppearanceProvider } from "@/components/appearance-provider";
import { AuthHashForwarder } from "@/components/auth-hash";
import { AuthProvider } from "@/components/auth-provider";
import { HeaderFallback, SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JournalProvider } from "@/components/journal-provider";
import { APPEARANCE_BOOT } from "@/lib/appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Awarely AI",
    template: "Awarely AI",
  },
  description:
    "A calm space to capture a moment, write what stands out, and keep a private visual journal in your browser.",
  applicationName: "awarely.ai",
};

export const viewport: Viewport = {
  themeColor: "#f7f3ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-appearance="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-foreground">
        <Script id="mindmate-appearance" strategy="beforeInteractive">
          {APPEARANCE_BOOT}
        </Script>
        <AppearanceProvider>
          <AuthProvider>
            <AuthHashForwarder />
            <JournalProvider>
            <a href="#content" className="skip-link">
              Skip to content
            </a>
            <div className="flex w-full flex-1 flex-col md:flex-row">
              <Suspense fallback={<HeaderFallback />}>
                <SiteHeader />
              </Suspense>
              <div className="flex min-w-0 flex-1 flex-col pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
                <main id="content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:max-w-6xl lg:px-8 lg:py-12 xl:max-w-7xl 2xl:max-w-[90rem] 2xl:py-16">
                  {children}
                </main>
                <SiteFooter />
              </div>
            </div>
            </JournalProvider>
          </AuthProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
